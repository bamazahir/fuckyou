-- M2: shared rooms, membership, live state, leaderboards, moderation, block/report, admin,
-- account deletion/export, profanity filter and the parental-consent flow.
-- SPEC §5, §7, §8, §9, §13, §13.1.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Profanity filter (SPEC §13). Source of truth: src/content/blocked-words.json.
-- ---------------------------------------------------------------------------
create table private.blocked_words (
  word text primary key check (word ~ '^[a-z]+$'),
  mode text not null check (mode in ('exact', 'prefix', 'anywhere'))
);
insert into private.blocked_words (word, mode) values
  ('fuck', 'prefix'),
  ('fuk', 'exact'),
  ('fck', 'exact'),
  ('shit', 'prefix'),
  ('bitch', 'prefix'),
  ('cunt', 'prefix'),
  ('dick', 'exact'),
  ('dickhead', 'exact'),
  ('cock', 'exact'),
  ('pussy', 'prefix'),
  ('asshole', 'anywhere'),
  ('arsehole', 'anywhere'),
  ('bastard', 'prefix'),
  ('whore', 'prefix'),
  ('slut', 'prefix'),
  ('wank', 'prefix'),
  ('twat', 'prefix'),
  ('porn', 'prefix'),
  ('nude', 'exact'),
  ('nudes', 'exact'),
  ('rape', 'exact'),
  ('rapist', 'prefix'),
  ('nazi', 'prefix'),
  ('hitler', 'anywhere'),
  ('nigger', 'anywhere'),
  ('nigga', 'anywhere'),
  ('faggot', 'anywhere'),
  ('fag', 'exact'),
  ('retard', 'prefix'),
  ('tranny', 'exact'),
  ('chink', 'exact'),
  ('spic', 'exact'),
  ('kike', 'exact'),
  ('paki', 'exact'),
  ('kys', 'exact'),
  ('killyourself', 'anywhere');

-- Mirrors src/core/filter.ts.
create function private.is_clean(p_text text) returns boolean
language sql stable security definer set search_path = '' as $$
  with norm as (
    select regexp_split_to_array(
             btrim(regexp_replace(translate(lower(coalesce(p_text, '')), '013457@$!', 'oieastasi'), '[^a-z]+', ' ', 'g')),
             ' ') as tokens
  ), j as (select tokens, array_to_string(tokens, '') as joined from norm)
  select not exists (
    select 1 from private.blocked_words w, j
    where (w.mode = 'anywhere' and position(w.word in j.joined) > 0)
       or (w.mode = 'exact' and w.word = any (j.tokens))
       or (w.mode = 'prefix' and exists (select 1 from unnest(j.tokens) t where starts_with(t, w.word)))
  )
$$;

create function private.require_clean(variadic p_texts text[]) returns void
language plpgsql stable set search_path = '' as $$
declare t text;
begin
  foreach t in array p_texts loop
    if t is not null and not private.is_clean(t) then
      raise exception 'inappropriate_text' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- Enforce on every write path, not only in RPCs.
create function private.profiles_filter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_clean(new.handle, new.display_name);
  return new;
end;
$$;
create trigger profiles_filter before insert or update of handle, display_name on public.profiles
  for each row execute function private.profiles_filter();

create function private.rooms_filter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_clean(new.name);
  return new;
end;
$$;
create trigger rooms_filter before insert or update of name on public.rooms
  for each row execute function private.rooms_filter();

create function private.sessions_filter() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_clean(new.status_line, new.note);
  return new;
end;
$$;
create trigger sessions_filter before insert or update of status_line, note on public.sessions
  for each row execute function private.sessions_filter();

-- ---------------------------------------------------------------------------
-- Rate limits (invite codes, previews, consent emails)
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);

create function private.client_key() returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select auth.uid())::text,
    'ip:' || split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), ',', 1)
  )
$$;

-- Returns true when the caller is over p_max hits in the current p_window_s second window.
create function private.over_limit(p_bucket text, p_max int, p_window_s int) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  v_hits int;
begin
  insert into private.rate_limits as r (key, window_start) values (p_bucket || ':' || private.client_key(), v_start)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return v_hits > p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------
create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'mod', 'member')),
  banned boolean not null default false,
  notify_active boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id);
create unique index room_members_one_owner on public.room_members (room_id) where role = 'owner';

alter table public.room_members enable row level security;
revoke all on table public.room_members from anon, authenticated;
grant select on table public.room_members to authenticated;
create policy room_members_select_own on public.room_members for select to authenticated
  using (user_id = (select auth.uid()));

create function private.am_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room and m.user_id = (select auth.uid()) and not m.banned
  )
$$;

create function private.my_role(p_room uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.room_members m
  where m.room_id = p_room and m.user_id = (select auth.uid()) and not m.banned
$$;

create function private.require_role(p_room uuid, variadic p_roles text[]) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.active_uid();
begin
  if coalesce(private.my_role(p_room), '') <> all (p_roles) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

drop policy rooms_select_own on public.rooms;
create policy rooms_select_member on public.rooms for select to authenticated
  using (owner_id = (select auth.uid()) or (select private.am_member(id)));

create or replace function private.can_study_in(p_room uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room
      and ((r.is_personal and r.owner_id = p_uid)
        or (not r.is_personal and exists (
              select 1 from public.room_members m
              where m.room_id = r.id and m.user_id = p_uid and not m.banned)))
  )
$$;

-- Realtime topic authorization: private channels "room:<uuid>" for members only (SPEC §9).
create function private.am_member_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_topic !~ '^room:[0-9a-f-]{36}$' then
    return false;
  end if;
  return private.am_member(substr(p_topic, 6)::uuid);
end;
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy studyroom_room_members_receive on realtime.messages for select to authenticated
        using ((select private.am_member_topic(realtime.topic())))
    $p$;
    execute $p$
      create policy studyroom_room_members_send on realtime.messages for insert to authenticated
        with check ((select private.am_member_topic(realtime.topic())) and extension in ('broadcast', 'presence'))
    $p$;
  end if;
end;
$$;

-- Server-side broadcast; a no-op where Realtime isn't installed (db-only test runs).
create function private.broadcast(p_room uuid, p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then
    return;
  end if;
  execute 'select realtime.send($1, $2, $3, true)' using p_payload, p_event, 'room:' || p_room::text;
exception when others then
  null; -- never fail a session write because of realtime
end;
$$;

-- ---------------------------------------------------------------------------
-- Ownership transfer when a profile is deleted (SPEC §7)
-- ---------------------------------------------------------------------------
create function private.handle_profile_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_next uuid;
begin
  for r in select id from public.rooms where owner_id = old.id and not is_personal loop
    select m.user_id into v_next
      from public.room_members m
     where m.room_id = r.id and m.user_id <> old.id and not m.banned
     order by (m.role = 'mod') desc, m.joined_at asc
     limit 1;
    if v_next is null then
      delete from public.rooms where id = r.id;
    else
      update public.room_members set role = 'member' where room_id = r.id and user_id = old.id;
      update public.room_members set role = 'owner' where room_id = r.id and user_id = v_next;
      update public.rooms set owner_id = v_next where id = r.id;
    end if;
  end loop;
  return old;
end;
$$;
create trigger profiles_transfer_rooms before delete on public.profiles
  for each row execute function private.handle_profile_delete();

-- ---------------------------------------------------------------------------
-- Blocks, reports, bans
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
revoke all on table public.blocks from anon, authenticated;
grant select on table public.blocks to authenticated;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('user', 'room', 'status_line', 'note', 'void')),
  target_id text not null check (char_length(target_id) <= 64),
  target_user_id uuid references public.profiles (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  reason text not null check (reason in ('harassment', 'inappropriate_name', 'cheating', 'unfair_void', 'other')),
  note text check (char_length(note) <= 140),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_open_idx on public.reports (created_at) where status = 'open';
create index reports_room_idx on public.reports (room_id);
alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;

create table private.banned_emails (email_hash text primary key, banned_at timestamptz not null default now());

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false)
$$;

-- ---------------------------------------------------------------------------
-- Parental consent (SPEC §13.1)
-- ---------------------------------------------------------------------------
create table public.parental_consents (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  parent_email text,
  parent_email_hash text not null,
  token_hash text not null unique,
  sends int not null default 1 check (sends between 1 and 3),
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz
);
alter table public.parental_consents enable row level security;
revoke all on table public.parental_consents from anon, authenticated;

create function private.sha256_hex(p text) returns text
language sql immutable set search_path = '' as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;

create function private.delete_user(p_uid uuid) returns void
language sql security definer set search_path = '' as $$ delete from auth.users where id = p_uid $$;

-- ---------------------------------------------------------------------------
-- Sessions: broadcast state changes to shared rooms
-- ---------------------------------------------------------------------------
create or replace function private.finish_session(p_id uuid, p_end timestamptz) returns public.sessions
language plpgsql security definer set search_path = '' as $$
declare
  s public.sessions;
  v_end timestamptz;
begin
  select * into s from public.sessions where id = p_id and status = 'active' for update;
  if not found then
    select * into s from public.sessions where id = p_id;
    return s;
  end if;
  v_end := private.session_end_time(s, p_end);
  update public.sessions
     set status = 'completed',
         ended_at = v_end,
         focus_seconds = floor(extract(epoch from (v_end - s.started_at)))::int,
         next_checkin_at = null
   where id = p_id
  returning * into s;
  insert into public.events (user_id, name, props)
  values (s.user_id, 'session_completed', jsonb_build_object('kind', s.kind, 'focus_min', s.focus_seconds / 60));
  perform private.broadcast(s.room_id, 'state',
    jsonb_build_object('user_id', s.user_id, 'state', case when s.kind = 'pomodoro' then 'break' else 'ended' end));
  return s;
end;
$$;

create function private.sessions_broadcast_start() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.broadcast(new.room_id, 'state', jsonb_build_object('user_id', new.user_id, 'state', 'focus'));
  return new;
end;
$$;
create trigger sessions_broadcast_start after insert on public.sessions
  for each row execute function private.sessions_broadcast_start();

-- Seconds a session has counted so far (active sessions count elapsed time).
create function private.session_seconds(s public.sessions) returns int
language sql stable set search_path = '' as $$
  select case
    when s.status = 'completed' then s.focus_seconds
    when s.status = 'active' then floor(extract(epoch from (private.session_end_time(s, now()) - s.started_at)))::int
    else 0 end
$$;

-- ---------------------------------------------------------------------------
-- Room RPCs
-- ---------------------------------------------------------------------------
create function public.create_room(p_name text, p_tz text, p_sync_pomodoro boolean default false) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  r public.rooms;
begin
  if (select count(*) from public.rooms where owner_id = v_uid and not is_personal) >= 10 then
    raise exception 'too_many_rooms_created' using errcode = '54000';
  end if;
  if (select count(*) from public.room_members where user_id = v_uid and not banned) >= 20 then
    raise exception 'too_many_rooms' using errcode = '54000';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 40 then
    raise exception 'invalid_room_name' using errcode = '22023';
  end if;
  insert into public.rooms (name, owner_id, tz, sync_pomodoro)
  values (btrim(p_name), v_uid, coalesce(nullif(btrim(p_tz), ''), 'UTC'), coalesce(p_sync_pomodoro, false))
  returning * into r;
  insert into public.room_members (room_id, user_id, role) values (r.id, v_uid, 'owner');
  insert into public.events (user_id, name) values (v_uid, 'room_created');
  return r;
end;
$$;

-- Public (anon) preview for invite links: name, size, and who is studying right now.
create function public.preview_room(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.rooms;
begin
  if private.over_limit('preview', 30, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  select * into r from public.rooms where invite_code = upper(btrim(p_code)) and not is_personal;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'member_count', (select count(*) from public.room_members m where m.room_id = r.id and not m.banned),
    'studying', coalesce((
      select jsonb_agg(jsonb_build_object('display_name', p.display_name, 'avatar', p.avatar) order by s.started_at)
        from public.sessions s join public.profiles p on p.id = s.user_id
       where s.room_id = r.id and s.status = 'active'), '[]'::jsonb)
  );
end;
$$;

create function public.join_room(p_code text) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  r public.rooms;
  m public.room_members;
begin
  if private.over_limit('join', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  select * into r from public.rooms where invite_code = upper(btrim(p_code)) and not is_personal;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  select * into m from public.room_members where room_id = r.id and user_id = v_uid;
  if found then
    if m.banned then
      raise exception 'banned_from_room' using errcode = '42501';
    end if;
    return r; -- already a member
  end if;
  if (select count(*) from public.room_members where room_id = r.id and not banned) >= 50 then
    raise exception 'room_full' using errcode = '54000';
  end if;
  if (select count(*) from public.room_members where user_id = v_uid and not banned) >= 20 then
    raise exception 'too_many_rooms' using errcode = '54000';
  end if;
  insert into public.room_members (room_id, user_id) values (r.id, v_uid);
  insert into public.events (user_id, name) values (v_uid, 'room_joined');
  perform private.broadcast(r.id, 'joined', jsonb_build_object('user_id', v_uid));
  return r;
end;
$$;

create function public.leave_room(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_role text := private.my_role(p_room_id);
  v_sid uuid;
begin
  if v_role is null then
    raise exception 'not_a_member' using errcode = 'P0002';
  end if;
  if v_role = 'owner' then
    if exists (select 1 from public.room_members where room_id = p_room_id and user_id <> v_uid and not banned) then
      raise exception 'owner_must_transfer' using errcode = '42501';
    end if;
    delete from public.rooms where id = p_room_id; -- last member out closes the room
    return;
  end if;
  for v_sid in select id from public.sessions where user_id = v_uid and room_id = p_room_id and status = 'active' loop
    perform private.finish_session(v_sid, now());
  end loop;
  delete from public.room_members where room_id = p_room_id and user_id = v_uid;
end;
$$;

create function public.regen_invite(p_room_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  perform private.require_role(p_room_id, 'owner', 'mod');
  update public.rooms set invite_code = private.new_invite_code() where id = p_room_id returning invite_code into v_code;
  return v_code;
end;
$$;

create function public.set_room(
  p_room_id uuid, p_name text default null, p_station_id text default null,
  p_sync_pomodoro boolean default null, p_sync_focus_s int default null, p_sync_break_s int default null
) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare r public.rooms;
begin
  perform private.require_role(p_room_id, 'owner', 'mod');
  update public.rooms
     set name = coalesce(nullif(btrim(p_name), ''), name),
         station_id = coalesce(p_station_id, station_id),
         sync_pomodoro = coalesce(p_sync_pomodoro, sync_pomodoro),
         sync_focus_s = coalesce(p_sync_focus_s, sync_focus_s),
         sync_break_s = coalesce(p_sync_break_s, sync_break_s),
         sync_epoch = case when p_sync_focus_s is distinct from null or p_sync_break_s is distinct from null
                           then now() else sync_epoch end
   where id = p_room_id
  returning * into r;
  return r;
end;
$$;

create function public.set_role(p_room_id uuid, p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role(p_room_id, 'owner');
  if p_role not in ('mod', 'member') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  update public.room_members set role = p_role
   where room_id = p_room_id and user_id = p_user_id and role <> 'owner' and not banned;
  if not found then
    raise exception 'not_a_member' using errcode = 'P0002';
  end if;
end;
$$;

create function public.transfer_ownership(p_room_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_role(p_room_id, 'owner');
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_user_id and not banned)
     or p_user_id = v_uid then
    raise exception 'not_a_member' using errcode = 'P0002';
  end if;
  update public.room_members set role = 'mod' where room_id = p_room_id and user_id = v_uid;
  update public.room_members set role = 'owner' where room_id = p_room_id and user_id = p_user_id;
  update public.rooms set owner_id = p_user_id where id = p_room_id;
end;
$$;

create function public.remove_member(p_room_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_role(p_room_id, 'owner', 'mod');
  v_target_role text;
  v_sid uuid;
begin
  select role into v_target_role from public.room_members where room_id = p_room_id and user_id = p_user_id;
  if v_target_role is null or p_user_id = v_uid then
    raise exception 'not_a_member' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' or (v_target_role = 'mod' and private.my_role(p_room_id) <> 'owner') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  for v_sid in select id from public.sessions where user_id = p_user_id and room_id = p_room_id and status = 'active' loop
    perform private.finish_session(v_sid, now());
  end loop;
  update public.room_members set banned = true, role = 'member' where room_id = p_room_id and user_id = p_user_id;
  perform private.broadcast(p_room_id, 'removed', jsonb_build_object('user_id', p_user_id));
end;
$$;

create function public.void_session(p_session_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.sessions;
  v_uid uuid;
begin
  select * into s from public.sessions where id = p_session_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  v_uid := private.require_role(s.room_id, 'owner', 'mod');
  if s.status <> 'completed' then
    raise exception 'cannot_void' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 140 then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  perform private.require_clean(p_reason);
  update public.sessions set status = 'voided', void_reason = btrim(p_reason) where id = p_session_id;
  -- Coin and bank reversal arrives with coins in M5.
  if (select count(*) from public.sessions x
       where x.user_id = s.user_id and x.room_id = s.room_id and x.status = 'voided'
         and x.ended_at > now() - interval '7 days') >= 3
     and not exists (select 1 from public.reports where target_type = 'void' and target_user_id = s.user_id
                       and room_id = s.room_id and created_at > now() - interval '7 days') then
    insert into public.reports (reporter_id, target_type, target_id, target_user_id, room_id, reason, note)
    values (null, 'void', p_session_id::text, s.user_id, s.room_id, 'unfair_void', 'auto: 3 voids in 7 days');
  end if;
end;
$$;

-- Who is in the room right now (SPEC §9): studying, or on a break after a pomodoro.
create function public.room_live(p_room_id uuid) returns table (
  user_id uuid, display_name text, avatar jsonb, state text, kind text, started_at timestamptz,
  planned_seconds int, status_line text, sitting_seconds int, break_until timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.am_member(p_room_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  return query
  with latest as (
    select distinct on (s.user_id) s.*
      from public.sessions s
      join public.room_members m on m.room_id = s.room_id and m.user_id = s.user_id and not m.banned
     where s.room_id = p_room_id and s.status in ('active', 'completed')
       and (s.status = 'active' or s.ended_at > now() - interval '20 minutes')
     order by s.user_id, s.started_at desc
  )
  select l.user_id, p.display_name, p.avatar,
         case when l.status = 'active' then 'focus' else 'break' end,
         l.kind, l.started_at, l.planned_seconds, l.status_line,
         (select coalesce(sum(private.session_seconds(x)), 0)::int
            from public.sessions x where x.sitting_id = l.sitting_id and x.status in ('active', 'completed')),
         case when l.status = 'completed' then l.ended_at + interval '15 minutes' end
    from latest l join public.profiles p on p.id = l.user_id
   where l.status = 'active'
      or (l.kind = 'pomodoro' and l.ended_at > now() - interval '15 minutes'
          and not exists (select 1 from public.sessions a where a.user_id = l.user_id and a.status = 'active'));
end;
$$;

create function public.room_members_list(p_room_id uuid) returns table (
  user_id uuid, handle text, display_name text, avatar jsonb, role text, joined_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.am_member(p_room_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.handle, p.display_name, p.avatar, m.role, m.joined_at
      from public.room_members m join public.profiles p on p.id = m.user_id
     where m.room_id = p_room_id and not m.banned
     order by (m.role = 'owner') desc, (m.role = 'mod') desc, m.joined_at;
end;
$$;

-- Home screen: my shared rooms with live counts (SPEC §5.2).
create function public.my_rooms() returns table (
  id uuid, name text, role text, invite_code text, member_count int, studying_count int, sync_pomodoro boolean,
  studying jsonb
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name, m.role, r.invite_code,
         (select count(*)::int from public.room_members x where x.room_id = r.id and not x.banned),
         (select count(*)::int from public.sessions s where s.room_id = r.id and s.status = 'active'),
         r.sync_pomodoro,
         coalesce((select jsonb_agg(jsonb_build_object('display_name', a.display_name, 'avatar', a.avatar))
                     from (select p.display_name, p.avatar from public.sessions s join public.profiles p on p.id = s.user_id
                            where s.room_id = r.id and s.status = 'active' order by s.started_at limit 4) a), '[]'::jsonb)
    from public.room_members m join public.rooms r on r.id = m.room_id
   where m.user_id = (select auth.uid()) and not m.banned and not r.is_personal
   order by (select count(*) from public.sessions s where s.room_id = r.id and s.status = 'active') desc, r.name
$$;

-- Room-only leaderboards (SPEC §5.3): live sitting, this week, all-time in room, lifetime.
create function public.leaderboard(p_room_id uuid, p_tab text) returns table (
  user_id uuid, display_name text, avatar jsonb, seconds int, rank int, is_present boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_week_start timestamptz;
begin
  if not private.am_member(p_room_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if p_tab not in ('live', 'week', 'alltime', 'lifetime') then
    raise exception 'invalid_tab' using errcode = '22023';
  end if;
  select r.tz into v_tz from public.rooms r where r.id = p_room_id;
  v_week_start := (date_trunc('week', now() at time zone v_tz)) at time zone v_tz;

  return query
  with members as (
    select m.user_id from public.room_members m where m.room_id = p_room_id and not m.banned
  ), counted as (
    select s.user_id, s.room_id, s.sitting_id, s.started_at, s.status, s.ended_at, private.session_seconds(s) as secs
      from public.sessions s join members mb on mb.user_id = s.user_id
     where s.status in ('active', 'completed')
  ), current_sitting as (
    select distinct on (c.user_id) c.user_id, c.sitting_id
      from counted c
     where c.room_id = p_room_id and (c.status = 'active' or c.ended_at > now() - interval '20 minutes')
     order by c.user_id, c.started_at desc
  ), totals as (
    select c.user_id, sum(c.secs)::int as total
      from counted c
     where case p_tab
             when 'live' then c.sitting_id in (select cs.sitting_id from current_sitting cs where cs.user_id = c.user_id)
             when 'week' then c.room_id = p_room_id and c.started_at >= v_week_start
             when 'alltime' then c.room_id = p_room_id
             else true
           end
     group by c.user_id
  )
  select t.user_id, p.display_name, p.avatar, t.total,
         (rank() over (order by t.total desc))::int,
         exists (select 1 from public.sessions a where a.user_id = t.user_id and a.room_id = p_room_id and a.status = 'active')
    from totals t join public.profiles p on p.id = t.user_id
   where t.total > 0
   order by t.total desc
   limit 50;
end;
$$;

-- Recent sessions of one member in a room, for owners/mods deciding on a void.
create function public.room_member_sessions(p_room_id uuid, p_user_id uuid) returns table (
  id uuid, kind text, status text, started_at timestamptz, focus_seconds int, void_reason text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role(p_room_id, 'owner', 'mod');
  return query
    select s.id, s.kind, s.status, s.started_at, s.focus_seconds, s.void_reason
      from public.sessions s
     where s.room_id = p_room_id and s.user_id = p_user_id and s.status in ('completed', 'voided')
     order by s.started_at desc
     limit 20;
end;
$$;

-- ---------------------------------------------------------------------------
-- Safety RPCs
-- ---------------------------------------------------------------------------
create function public.block_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.active_uid();
begin
  if p_user_id = v_uid then
    raise exception 'cannot_block_self' using errcode = '22023';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user_id) on conflict do nothing;
  insert into public.events (user_id, name) values (v_uid, 'user_blocked');
end;
$$;

create function public.unblock_user(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker_id = private.active_uid() and blocked_id = p_user_id
$$;

create function public.report(
  p_target_type text, p_target_id text, p_room_id uuid, p_reason text, p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_target_user uuid;
begin
  if private.over_limit('report', 10, 3600) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if p_room_id is not null and not private.am_member(p_room_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  v_target_user := case
    when p_target_type in ('user') then p_target_id::uuid
    when p_target_type in ('status_line', 'note', 'void') then (select s.user_id from public.sessions s where s.id = p_target_id::uuid)
  end;
  insert into public.reports (reporter_id, target_type, target_id, target_user_id, room_id, reason, note)
  values (v_uid, p_target_type, p_target_id, v_target_user, p_room_id, p_reason, nullif(btrim(p_note), ''));
  insert into public.events (user_id, name) values (v_uid, 'report_filed');
end;
$$;

-- Owners/mods see their room's open reports, except reports about themselves.
create function public.room_reports(p_room_id uuid) returns setof public.reports
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := private.require_role(p_room_id, 'owner', 'mod');
begin
  return query
    select * from public.reports r
     where r.room_id = p_room_id and r.status = 'open' and r.target_user_id is distinct from v_uid
     order by r.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin (the builder) — moderation queue
-- ---------------------------------------------------------------------------
create function public.admin_list_reports() returns table (
  id bigint, target_type text, target_id text, target_user_id uuid, target_display_name text, target_handle text,
  room_id uuid, room_name text, reason text, note text, created_at timestamptz, context text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select r.id, r.target_type, r.target_id, r.target_user_id, p.display_name, p.handle, r.room_id, rm.name,
           r.reason, r.note, r.created_at,
           case r.target_type
             when 'room' then rm.name
             when 'status_line' then (select s.status_line from public.sessions s where s.id::text = r.target_id)
             when 'note' then (select s.note from public.sessions s where s.id::text = r.target_id)
             when 'void' then (select s.void_reason from public.sessions s where s.id::text = r.target_id)
             else p.display_name end
      from public.reports r
      left join public.profiles p on p.id = r.target_user_id
      left join public.rooms rm on rm.id = r.room_id
     where r.status = 'open'
     order by r.created_at;
end;
$$;

-- action: dismiss | remove_content | ban_user | delete_room
create function public.admin_resolve_report(p_report_id bigint, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into r from public.reports where id = p_report_id;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  case p_action
    when 'dismiss' then null;
    when 'remove_content' then
      if r.target_type = 'user' then
        update public.profiles set display_name = 'Renamed user' where id = r.target_user_id;
      elsif r.target_type = 'room' then
        update public.rooms set name = 'Renamed room' where id = r.room_id;
      elsif r.target_type = 'status_line' then
        update public.sessions set status_line = null where id::text = r.target_id;
      elsif r.target_type = 'note' then
        update public.sessions set note = null, note_public = false where id::text = r.target_id;
      elsif r.target_type = 'void' then
        update public.sessions set status = 'completed', void_reason = null where id::text = r.target_id and status = 'voided';
      end if;
    when 'ban_user' then
      if r.target_user_id is null then
        raise exception 'no_target_user' using errcode = '22023';
      end if;
      insert into private.banned_emails (email_hash)
        select private.sha256_hex(lower(u.email)) from auth.users u where u.id = r.target_user_id and u.email is not null
      on conflict do nothing;
      perform private.delete_user(r.target_user_id);
    when 'delete_room' then
      delete from public.rooms where id = r.room_id and not is_personal;
    else
      raise exception 'invalid_action' using errcode = '22023';
  end case;
  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end
   where id = p_report_id or (p_action in ('ban_user') and target_user_id = r.target_user_id and status = 'open');
end;
$$;

-- ---------------------------------------------------------------------------
-- Account: delete & export (SPEC §13)
-- ---------------------------------------------------------------------------
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform private.delete_user(v_uid); -- cascades; rooms are handed on by profiles_transfer_rooms
end;
$$;

create function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at) from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) - 'is_admin' from public.profiles p where p.id = v_uid),
    'rooms', coalesce((select jsonb_agg(jsonb_build_object('room', r.name, 'role', m.role, 'joined_at', m.joined_at))
                         from public.room_members m join public.rooms r on r.id = m.room_id where m.user_id = v_uid), '[]'),
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.started_at)
                            from public.sessions s where s.user_id = v_uid), '[]'),
    'blocks', coalesce((select jsonb_agg(b.blocked_id) from public.blocks b where b.blocker_id = v_uid), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('type', r.target_type, 'reason', r.reason, 'at', r.created_at))
                                 from public.reports r where r.reporter_id = v_uid), '[]'),
    'parental_consent', (select jsonb_build_object('granted_at', c.granted_at, 'expires_at', c.expires_at)
                           from public.parental_consents c where c.user_id = v_uid)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Consent RPCs (SPEC §13.1)
-- ---------------------------------------------------------------------------
create function public.request_parental_consent(p_parent_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_parent_email, '')));
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  c public.parental_consents;
  v_name text;
begin
  select p.display_name into v_name from public.profiles p where p.id = v_uid and p.consent_status = 'pending';
  if v_name is null then
    raise exception 'consent_not_needed' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_email = (select lower(u.email) from auth.users u where u.id = v_uid) then
    raise exception 'parent_email_is_yours' using errcode = '22023';
  end if;
  select * into c from public.parental_consents where user_id = v_uid;
  if found then
    if c.sends >= 3 then
      raise exception 'too_many_requests' using errcode = '54000';
    end if;
    if c.last_sent_at > now() - interval '2 minutes' then
      raise exception 'rate_limited' using errcode = '54000';
    end if;
    update public.parental_consents
       set parent_email = v_email, parent_email_hash = private.sha256_hex(v_email),
           token_hash = private.sha256_hex(v_token), sends = sends + 1, last_sent_at = now()
     where user_id = v_uid;
  else
    insert into public.parental_consents (user_id, parent_email, parent_email_hash, token_hash, expires_at)
    values (v_uid, v_email, private.sha256_hex(v_email), private.sha256_hex(v_token), now() + interval '7 days');
  end if;
  insert into public.notify_queue (user_id, kind, payload)
  values (v_uid, 'consent_email', jsonb_build_object('to', v_email, 'token', v_token, 'child_display_name', v_name));
  insert into public.events (user_id, name) values (v_uid, 'consent_requested');
end;
$$;

-- Public, for the parent page. Reveals only the child's display name and the request state.
create function public.consent_view(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.parental_consents;
  v_name text;
begin
  if private.over_limit('consent_view', 20, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  select * into c from public.parental_consents where token_hash = private.sha256_hex(btrim(coalesce(p_token, '')));
  if not found then
    raise exception 'consent_not_found' using errcode = 'P0002';
  end if;
  select p.display_name into v_name from public.profiles p where p.id = c.user_id;
  return jsonb_build_object(
    'child_display_name', v_name,
    'state', case when c.granted_at is not null then 'granted'
                  when c.expires_at < now() then 'expired'
                  else 'pending' end,
    'expires_at', c.expires_at
  );
end;
$$;

create function public.consent_decide(p_token text, p_decision text) returns text
language plpgsql security definer set search_path = '' as $$
declare c public.parental_consents;
begin
  if private.over_limit('consent_decide', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  select * into c from public.parental_consents where token_hash = private.sha256_hex(btrim(coalesce(p_token, ''))) for update;
  if not found then
    raise exception 'consent_not_found' using errcode = 'P0002';
  end if;
  if p_decision = 'grant' then
    if c.granted_at is not null then
      return 'granted';
    end if;
    if c.expires_at < now() then
      raise exception 'consent_expired' using errcode = '22023';
    end if;
    update public.parental_consents set granted_at = now(), parent_email = null where user_id = c.user_id;
    update public.profiles set consent_status = 'granted' where id = c.user_id;
    insert into public.events (user_id, name) values (c.user_id, 'consent_granted');
    return 'granted';
  elsif p_decision in ('decline', 'withdraw') then
    perform private.delete_user(c.user_id);
    return 'deleted';
  end if;
  raise exception 'invalid_decision' using errcode = '22023';
end;
$$;

-- Banned emails can't come back.
create or replace function public.complete_profile(
  p_handle text, p_display_name text, p_country text, p_age_bracket text, p_avatar jsonb, p_tz text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_age int;
  v_consent_age int;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_exists' using errcode = '42501';
  end if;
  if exists (select 1 from auth.users u join private.banned_emails b on b.email_hash = private.sha256_hex(lower(u.email))
              where u.id = v_uid) then
    raise exception 'account_banned' using errcode = '42501';
  end if;
  if lower(btrim(coalesce(p_handle, ''))) !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid_handle' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 30 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;
  v_age := case p_age_bracket when '13' then 13 when '14' then 14 when '15' then 15
                              when '16-17' then 16 when '18+' then 18 end;
  if v_age is null then
    raise exception 'invalid_age_bracket' using errcode = '22023';
  end if;
  select c.consent_age into v_consent_age from public.consent_ages c where c.country = upper(p_country);
  v_consent_age := coalesce(v_consent_age, private.default_consent_age());
  v_status := case when v_age >= v_consent_age then 'not_required' else 'pending' end;

  begin
    insert into public.profiles (id, handle, display_name, avatar, tz, country, age_bracket, consent_status)
    values (v_uid, lower(btrim(p_handle)), btrim(p_display_name), p_avatar, coalesce(nullif(btrim(p_tz), ''), 'UTC'),
            upper(p_country), p_age_bracket, v_status);
  exception when unique_violation then
    raise exception 'handle_taken' using errcode = '23505';
  end;

  insert into public.events (user_id, name, props)
  values (v_uid, 'signup', jsonb_build_object('consent', v_status));
  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Queue dispatch + tick additions
-- ---------------------------------------------------------------------------
-- Calls the push Edge Function when sendable rows exist. Needs Vault secrets
-- 'push_function_url' and 'push_secret' (SPEC §9); silently skips until they're set.
create function private.dispatch_queue() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.notify_queue where sent_at is null and send_after <= now() and kind = 'consent_email') then
    return;
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null or to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'push_function_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'push_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_url, '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret);
end;
$$;

create or replace function private.tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_done int := 0;
  v_checkins int := 0;
  v_expired int := 0;
begin
  -- 1. Pomodoro end
  for r in
    select id, user_id, room_id from public.sessions
     where status = 'active' and kind = 'pomodoro'
       and started_at + make_interval(secs => planned_seconds) <= now()
  loop
    perform private.finish_session(r.id, now());
    insert into public.notify_queue (user_id, kind, payload)
    values (r.user_id, 'phase_end', jsonb_build_object('session_id', r.id, 'room_id', r.room_id));
    v_done := v_done + 1;
  end loop;

  -- 2a. Check-in missed: complete at the time the check-in was due
  for r in
    select id, next_checkin_at from public.sessions
     where status = 'active' and kind = 'stopwatch' and next_checkin_at + interval '10 minutes' <= now()
  loop
    perform private.finish_session(r.id, r.next_checkin_at);
    v_done := v_done + 1;
  end loop;

  -- 2b. Check-in due: ask once
  with due as (
    update public.sessions set checkin_notified = true
     where status = 'active' and kind = 'stopwatch' and not checkin_notified and next_checkin_at <= now()
    returning id, user_id, room_id
  )
  insert into public.notify_queue (user_id, kind, payload)
  select user_id, 'checkin', jsonb_build_object('session_id', id, 'room_id', room_id) from due;
  get diagnostics v_checkins = row_count;

  -- 3. 4h hard cap
  for r in
    select id from public.sessions where status = 'active' and started_at + interval '4 hours' <= now()
  loop
    perform private.finish_session(r.id, now());
    v_done := v_done + 1;
  end loop;

  -- 4. Consent expiry: no parental answer within 7 days of signup or of the request → delete (SPEC §13.1)
  for r in
    select p.id from public.profiles p
      left join public.parental_consents c on c.user_id = p.id
     where p.consent_status = 'pending'
       and coalesce(c.expires_at, p.created_at + interval '7 days') <= now()
  loop
    perform private.delete_user(r.id);
    v_expired := v_expired + 1;
  end loop;

  perform private.dispatch_queue();
  return jsonb_build_object('finished', v_done, 'checkins', v_checkins, 'consent_expired', v_expired);
end;
$$;

-- Daily housekeeping
create function private.daily() returns void
language sql security definer set search_path = '' as $$
  delete from public.events where at < now() - interval '400 days';
  delete from public.notify_queue where created_at < now() - interval '7 days';
  delete from private.rate_limits where window_start < now() - interval '1 day';
$$;
select cron.schedule('studyroom-daily', '17 3 * * *', 'select private.daily()');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.valid_avatar(jsonb) to authenticated;
-- Realtime policies evaluate this as the connecting user.
grant execute on function private.am_member_topic(text) to authenticated;
grant execute on function private.am_member(uuid) to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_room(text,text,boolean)', 'public.join_room(text)', 'public.leave_room(uuid)',
    'public.regen_invite(uuid)', 'public.set_room(uuid,text,text,boolean,integer,integer)',
    'public.set_role(uuid,uuid,text)', 'public.transfer_ownership(uuid,uuid)', 'public.remove_member(uuid,uuid)',
    'public.void_session(uuid,text)', 'public.room_live(uuid)', 'public.room_members_list(uuid)',
    'public.leaderboard(uuid,text)', 'public.room_member_sessions(uuid,uuid)', 'public.block_user(uuid)',
    'public.unblock_user(uuid)', 'public.report(text,text,uuid,text,text)', 'public.room_reports(uuid)',
    'public.admin_list_reports()', 'public.admin_resolve_report(bigint,text)', 'public.delete_my_account()', 'public.my_rooms()',
    'public.export_my_data()', 'public.request_parental_consent(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array['public.preview_room(text)', 'public.consent_view(text)', 'public.consent_decide(text,text)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end;
$$;
revoke all on function public.complete_profile(text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.complete_profile(text, text, text, text, jsonb, text) to authenticated;

-- Supabase grants EXECUTE to anon by default; M1's revokes only covered PUBLIC. Signed-out visitors
-- may call only the public-page functions (health, server_time, preview_room, consent_view, consent_decide).
revoke all on function public.reject_underage() from anon;
revoke all on function public.start_session(uuid, text, int, text) from anon;
revoke all on function public.end_session(uuid) from anon;
revoke all on function public.checkin(uuid) from anon;
revoke all on function public.submit_note(uuid, text, boolean) from anon;
revoke all on function public.log_event(text, jsonb) from anon;
