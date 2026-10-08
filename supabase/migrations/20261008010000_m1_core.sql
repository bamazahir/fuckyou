-- M1: profiles + consent, personal rooms, server-authoritative sessions, events, notify queue, tick().
-- SPEC §6, §8, §9, §13.1. All writes go through security definer RPCs; clients only read.

create extension if not exists pg_cron;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consent ages (SPEC §13.1). Source of truth: src/content/consent-ages.json.
-- ---------------------------------------------------------------------------
create table public.consent_ages (
  country text primary key check (country ~ '^[A-Z]{2}$'),
  consent_age int not null check (consent_age between 13 and 18)
);
insert into public.consent_ages (country, consent_age) values
  ('AT', 14),
  ('AU', 15),
  ('BE', 13),
  ('BG', 14),
  ('CA', 14),
  ('CN', 14),
  ('CY', 14),
  ('CZ', 15),
  ('DE', 16),
  ('DK', 13),
  ('EE', 13),
  ('ES', 14),
  ('FI', 13),
  ('FR', 15),
  ('GB', 13),
  ('GR', 15),
  ('HR', 16),
  ('HU', 16),
  ('IE', 16),
  ('IN', 18),
  ('IS', 13),
  ('IT', 14),
  ('KR', 14),
  ('LT', 14),
  ('LU', 16),
  ('LV', 13),
  ('MT', 13),
  ('NL', 16),
  ('NO', 13),
  ('PL', 16),
  ('PT', 13),
  ('RO', 16),
  ('SE', 13),
  ('SI', 15),
  ('SK', 16),
  ('US', 13);

alter table public.consent_ages enable row level security;
revoke all on table public.consent_ages from anon, authenticated;
grant select on table public.consent_ages to anon, authenticated;
create policy consent_ages_read on public.consent_ages for select to anon, authenticated using (true);

create function private.default_consent_age() returns int language sql immutable as $$ select 16 $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
-- Avatar shape: {"colors": {"body": "#rrggbb", "skin": ..., "hair": ..., "top": ...}, "accessories": [..]}
create function private.valid_avatar(a jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(a) = 'object'
     and jsonb_typeof(a -> 'colors') = 'object'
     and (select bool_and(coalesce(a -> 'colors' ->> k, '') ~ '^#[0-9a-fA-F]{6}$')
            from unnest(array['body', 'skin', 'hair', 'top']) as k)
     and (a -> 'accessories' is null or jsonb_typeof(a -> 'accessories') = 'array')
     and pg_column_size(a) < 2048
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (
    char_length(display_name) between 1 and 30
    and display_name = btrim(display_name)
    and display_name !~ '[[:cntrl:]]'
  ),
  avatar jsonb not null check (private.valid_avatar(avatar)),
  tz text not null default 'UTC' check (char_length(tz) between 1 and 64),
  country text not null check (country ~ '^[A-Z]{2}$'),
  age_bracket text not null check (age_bracket in ('13', '14', '15', '16-17', '18+')),
  consent_status text not null check (consent_status in ('not_required', 'pending', 'granted')),
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 4096),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Users may edit only these columns directly; everything else goes through RPCs.
grant update (display_name, avatar, tz, settings) on table public.profiles to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- A user counts as active once their profile exists and consent is settled.
create function private.active_uid() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.consent_status in ('not_required', 'granted')
  ) then
    raise exception 'consent_required' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rooms (M1 creates only personal rooms; shared rooms arrive in M2)
-- ---------------------------------------------------------------------------
create function private.new_invite_code() returns text
language sql volatile set search_path = '' as $$
  -- 8 chars of Crockford-ish base32 (no I, L, O, U): ~40 bits.
  select string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + (get_byte(b, i) % 32), 1), '')
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) as i
$$;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 40 and name = btrim(name)),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  tz text not null check (char_length(tz) between 1 and 64),
  sync_pomodoro boolean not null default false,
  sync_focus_s int not null default 1500 check (sync_focus_s between 600 and 5400),
  sync_break_s int not null default 300 check (sync_break_s between 60 and 1800),
  sync_epoch timestamptz not null default now(),
  invite_code text not null unique default private.new_invite_code(),
  is_personal boolean not null default false,
  station_id text not null default 'lofi' check (station_id ~ '^[a-z0-9_]{1,32}$'),
  layout jsonb not null default '[]' check (jsonb_typeof(layout) = 'array'),
  bank_coins int not null default 0,
  created_at timestamptz not null default now()
);
create index rooms_owner_idx on public.rooms (owner_id);
create unique index rooms_one_personal_per_owner on public.rooms (owner_id) where is_personal;

alter table public.rooms enable row level security;
revoke all on table public.rooms from anon, authenticated;
grant select on table public.rooms to authenticated;
create policy rooms_select_own on public.rooms for select to authenticated
  using (owner_id = (select auth.uid()));

-- M1: you can study in your own personal room. M2 extends this to room members.
create function private.can_study_in(p_room uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rooms r where r.id = p_room and r.is_personal and r.owner_id = p_uid)
$$;

create function private.create_personal_room() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.rooms (name, owner_id, tz, is_personal) values ('My room', new.id, new.tz, true);
  return new;
end;
$$;
create trigger profiles_create_personal_room after insert on public.profiles
  for each row execute function private.create_personal_room();

-- ---------------------------------------------------------------------------
-- Sessions (SPEC §6). Durations are computed here, never sent by clients.
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  sitting_id uuid not null,
  kind text not null check (kind in ('pomodoro', 'stopwatch')),
  status text not null default 'active' check (status in ('active', 'completed', 'voided')),
  status_line text check (char_length(status_line) between 1 and 60),
  planned_seconds int check (planned_seconds between 300 and 7200),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  next_checkin_at timestamptz,
  checkin_notified boolean not null default false,
  focus_seconds int check (focus_seconds between 0 and 14400),
  note text check (char_length(note) between 3 and 140),
  note_public boolean not null default false,
  coins_paid boolean not null default false,
  void_reason text check (char_length(void_reason) <= 140),
  constraint sessions_planned_matches_kind check ((kind = 'pomodoro') = (planned_seconds is not null)),
  constraint sessions_checkin_matches_kind check (kind = 'stopwatch' or next_checkin_at is null),
  constraint sessions_ended_matches_status check ((status = 'active') = (ended_at is null)),
  constraint sessions_focus_when_ended check ((ended_at is null) = (focus_seconds is null))
);
create unique index sessions_one_active_per_user on public.sessions (user_id) where status = 'active';
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index sessions_room_started_idx on public.sessions (room_id, started_at);
create index sessions_active_idx on public.sessions (started_at) where status = 'active';

alter table public.sessions enable row level security;
revoke all on table public.sessions from anon, authenticated;
grant select on table public.sessions to authenticated;
create policy sessions_select_own on public.sessions for select to authenticated
  using (user_id = (select auth.uid()));

-- Mirrors src/core/accounting.ts focusSeconds().
create function private.session_end_time(s public.sessions, p_end timestamptz) returns timestamptz
language sql immutable set search_path = '' as $$
  select least(
    greatest(p_end, s.started_at),
    s.started_at + interval '4 hours',
    case when s.kind = 'pomodoro' then s.started_at + make_interval(secs => s.planned_seconds) end
  )
$$;

create function private.finish_session(p_id uuid, p_end timestamptz) returns public.sessions
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
  return s;
end;
$$;

-- ---------------------------------------------------------------------------
-- Events (SPEC §12): first-party metrics only, no free text.
-- ---------------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (name in (
    'signup', 'onboarding_done', 'room_created', 'room_joined', 'session_started', 'session_completed',
    'consent_requested', 'consent_granted', 'note_submitted', 'reaction_sent', 'nudge_sent', 'item_bought',
    'donated', 'push_enabled', 'pwa_installed', 'app_open', 'report_filed', 'user_blocked'
  )),
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) < 512),
  at timestamptz not null default now()
);
create index events_name_at_idx on public.events (name, at);
create index events_user_at_idx on public.events (user_id, at);

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;
grant select on table public.events to authenticated;
create policy events_select_admin on public.events for select to authenticated
  using ((select p.is_admin from public.profiles p where p.id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Notify queue (SPEC §9). Written by tick(); sent by the push Edge Function from M3.
-- ---------------------------------------------------------------------------
create table public.notify_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('phase_end', 'checkin', 'room_active', 'consent_email')),
  payload jsonb not null default '{}',
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notify_queue_unsent_idx on public.notify_queue (send_after) where sent_at is null;
create index notify_queue_user_idx on public.notify_queue (user_id);
alter table public.notify_queue enable row level security;
revoke all on table public.notify_queue from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function public.server_time() returns timestamptz
language sql volatile security invoker set search_path = '' as $$ select clock_timestamp() $$;

-- Under-13: delete the auth user before any profile exists (SPEC §13.1).
create function public.reject_underage() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_exists' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

create function public.complete_profile(
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

create function public.start_session(
  p_room_id uuid, p_kind text, p_planned_seconds int default null, p_status_line text default null
) returns public.sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_prev uuid;
  v_sitting uuid;
  s public.sessions;
begin
  if not private.can_study_in(p_room_id, v_uid) then
    raise exception 'room_not_allowed' using errcode = '42501';
  end if;
  if p_kind not in ('pomodoro', 'stopwatch') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if p_kind = 'stopwatch' and p_planned_seconds is not null then
    raise exception 'stopwatch_has_no_plan' using errcode = '22023';
  end if;

  -- Serialise starts per user so the one-active-session rule can't race.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  for v_prev in select id from public.sessions where user_id = v_uid and status = 'active' loop
    perform private.finish_session(v_prev, now());
  end loop;

  select x.sitting_id into v_sitting
    from public.sessions x
   where x.user_id = v_uid and x.room_id = p_room_id and x.status = 'completed'
     and x.ended_at >= now() - interval '20 minutes'
   order by x.ended_at desc
   limit 1;

  insert into public.sessions (user_id, room_id, sitting_id, kind, planned_seconds, status_line, next_checkin_at)
  values (v_uid, p_room_id, coalesce(v_sitting, gen_random_uuid()), p_kind, p_planned_seconds,
          nullif(btrim(p_status_line), ''),
          case when p_kind = 'stopwatch' then now() + interval '50 minutes' end)
  returning * into s;

  insert into public.events (user_id, name, props) values (v_uid, 'session_started', jsonb_build_object('kind', p_kind));
  return s;
end;
$$;

create function public.end_session(p_session_id uuid) returns public.sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
begin
  if not exists (select 1 from public.sessions where id = p_session_id and user_id = v_uid) then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  -- Idempotent: an already-finished session is returned unchanged.
  return private.finish_session(p_session_id, now());
end;
$$;

create function public.checkin(p_session_id uuid) returns public.sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  s public.sessions;
begin
  update public.sessions
     set next_checkin_at = now() + interval '50 minutes', checkin_notified = false
   where id = p_session_id and user_id = v_uid and status = 'active' and kind = 'stopwatch'
     and now() <= next_checkin_at + interval '10 minutes'
  returning * into s;
  if not found then
    raise exception 'checkin_not_possible' using errcode = 'P0002';
  end if;
  return s;
end;
$$;

create function public.submit_note(p_session_id uuid, p_note text, p_public boolean default false) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_note text := btrim(p_note);
begin
  if char_length(v_note) not between 3 and 140 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  update public.sessions
     set note = v_note, note_public = coalesce(p_public, false)
   where id = p_session_id and user_id = v_uid and status = 'completed' and note is null
     and ended_at >= now() - interval '24 hours';
  if not found then
    raise exception 'note_not_possible' using errcode = 'P0002';
  end if;
  insert into public.events (user_id, name) values (v_uid, 'note_submitted');
  return 0; -- coins arrive in M5 (SPEC §6.5)
end;
$$;

-- Client-logged events: allowlisted names, props limited to numbers, booleans and short slugs.
create function public.log_event(p_name text, p_props jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_props jsonb := coalesce(p_props, '{}');
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    return;
  end if;
  if p_name not in ('app_open', 'onboarding_done', 'pwa_installed', 'push_enabled') then
    raise exception 'event_not_allowed' using errcode = '22023';
  end if;
  if jsonb_typeof(v_props) <> 'object' or exists (
    select 1 from jsonb_each(v_props) e
    where not (jsonb_typeof(e.value) in ('number', 'boolean')
               or (jsonb_typeof(e.value) = 'string' and e.value #>> '{}' ~ '^[a-z0-9_]{1,20}$'))
       or e.key !~ '^[a-z_]{1,20}$'
  ) then
    raise exception 'invalid_props' using errcode = '22023';
  end if;
  if (select count(*) from public.events where user_id = v_uid and at > now() - interval '1 minute') >= 30 then
    return; -- silently rate-limited
  end if;
  insert into public.events (user_id, name, props) values (v_uid, p_name, v_props);
end;
$$;

-- ---------------------------------------------------------------------------
-- tick(): runs every 10 seconds (SPEC §9). Each transition is idempotent.
-- ---------------------------------------------------------------------------
create function private.tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_done int := 0;
  v_checkins int := 0;
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

  return jsonb_build_object('finished', v_done, 'checkins', v_checkins);
end;
$$;

select cron.schedule('studyroom-tick', '10 seconds', 'select private.tick()');

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is callable unless granted here.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.server_time() from public;
revoke all on function public.reject_underage() from public;
revoke all on function public.complete_profile(text, text, text, text, jsonb, text) from public;
revoke all on function public.start_session(uuid, text, int, text) from public;
revoke all on function public.end_session(uuid) from public;
revoke all on function public.checkin(uuid) from public;
revoke all on function public.submit_note(uuid, text, boolean) from public;
revoke all on function public.log_event(text, jsonb) from public;
revoke all on function public.health() from anon, authenticated;
grant execute on function public.health() to anon, authenticated;
grant execute on function public.server_time() to anon, authenticated;
grant execute on function public.reject_underage() to authenticated;
grant execute on function public.complete_profile(text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.start_session(uuid, text, int, text) to authenticated;
grant execute on function public.end_session(uuid) to authenticated;
grant execute on function public.checkin(uuid) to authenticated;
grant execute on function public.submit_note(uuid, text, boolean) to authenticated;
grant execute on function public.log_event(text, jsonb) to authenticated;
-- RLS policies and constraints call these helpers as the querying role.
grant usage on schema private to authenticated;
grant execute on function private.valid_avatar(jsonb) to authenticated;
