-- M3: web push (subscriptions, queue filling, "room is active") and the room-synced pomodoro (SPEC §6.2.1, §9).

-- ---------------------------------------------------------------------------
-- Push subscriptions (one row per browser/device)
-- ---------------------------------------------------------------------------
-- Endpoints must belong to a real push service: the push Edge Function POSTs to them, so an arbitrary
-- URL would let a client aim our server at anything (SSRF).
create function private.valid_push_endpoint(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
     and char_length(p) <= 1000
$$;

create table public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (private.valid_push_endpoint(endpoint)),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_=-]{80,100}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_=-]{16,32}$'),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select on table public.push_subscriptions to authenticated;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.active_uid();
begin
  if not private.valid_push_endpoint(coalesce(p_endpoint, '')) then
    raise exception 'invalid_push_endpoint' using errcode = '22023';
  end if;
  -- A shared device that switches accounts moves the endpoint to whoever is signed in now.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh,
                                       auth = excluded.auth, created_at = now();
  -- Keep at most 10 devices per person.
  delete from public.push_subscriptions
   where user_id = v_uid
     and id not in (select id from public.push_subscriptions where user_id = v_uid order by created_at desc limit 10);
end;
$$;

-- Works for any signed-in user (also pending ones), so sign-out can always clean up.
create function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Notification preferences
-- ---------------------------------------------------------------------------
-- profiles.settings.notify.{phase_end, checkin} = false turns a type off (default on).
create function private.wants_push(p_uid uuid, p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.push_subscriptions s where s.user_id = p_uid)
     and coalesce((select (p.settings -> 'notify' ->> p_kind)::boolean from public.profiles p where p.id = p_uid), true)
$$;

create function public.set_room_notify(p_room_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.active_uid();
begin
  update public.room_members set notify_active = coalesce(p_on, false)
   where room_id = p_room_id and user_id = v_uid and not banned;
  if not found then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
end;
$$;

-- Room details the room screen needs beyond my_rooms: sync settings and my own toggle.
create function public.room_info(p_room_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.am_member(p_room_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'sync_pomodoro', r.sync_pomodoro, 'sync_focus_s', r.sync_focus_s, 'sync_break_s', r.sync_break_s,
      'sync_epoch', r.sync_epoch, 'notify_active', m.notify_active)
      from public.rooms r join public.room_members m on m.room_id = r.id and m.user_id = (select auth.uid())
     where r.id = p_room_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- "Room is active" (SPEC §9.5): enqueue when someone starts studying
-- ---------------------------------------------------------------------------
create function private.enqueue_room_active() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select is_personal from public.rooms where id = new.room_id) then
    return new;
  end if;
  insert into public.notify_queue (user_id, kind, payload)
  select m.user_id, 'room_active',
         jsonb_build_object('room_id', new.room_id, 'room_name', r.name, 'name', p.display_name)
    from public.room_members m
    join public.rooms r on r.id = m.room_id
    join public.profiles p on p.id = new.user_id
    join public.profiles mp on mp.id = m.user_id
   where m.room_id = new.room_id
     and m.notify_active and not m.banned
     and m.user_id <> new.user_id
     and mp.consent_status in ('not_required', 'granted')
     and exists (select 1 from public.push_subscriptions ps where ps.user_id = m.user_id)
     and not exists (select 1 from public.sessions s
                      where s.user_id = m.user_id and s.room_id = new.room_id and s.status = 'active')
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = m.user_id and b.blocked_id = new.user_id)
                         or (b.blocker_id = new.user_id and b.blocked_id = m.user_id))
     and not exists (select 1 from public.notify_queue q
                      where q.user_id = m.user_id and q.kind = 'room_active'
                        and q.payload ->> 'room_id' = new.room_id::text
                        and q.created_at > now() - interval '2 hours');
  return new;
end;
$$;
create trigger sessions_room_active after insert on public.sessions
  for each row execute function private.enqueue_room_active();

-- ---------------------------------------------------------------------------
-- Room-synced pomodoro (SPEC §6.2.1). Mirrors src/core/sync.ts.
-- ---------------------------------------------------------------------------
create function private.sync_phase(p_epoch timestamptz, p_focus_s int, p_break_s int, p_at timestamptz)
returns table (phase text, left_s numeric)
language sql immutable set search_path = '' as $$
  with t as (
    select mod(mod(extract(epoch from (p_at - p_epoch)), p_focus_s + p_break_s) + (p_focus_s + p_break_s),
               p_focus_s + p_break_s) as pos
  )
  select case when pos < p_focus_s then 'focus' else 'break' end,
         case when pos < p_focus_s then p_focus_s - pos else p_focus_s + p_break_s - pos end
    from t
$$;

-- Joining late may leave less than 5 minutes; plain pomodoros keep their 5–120 minute range in the RPC.
alter table public.sessions drop constraint sessions_planned_seconds_check;
alter table public.sessions add constraint sessions_planned_seconds_check check (planned_seconds between 60 and 7200);

create or replace function public.start_session(
  p_room_id uuid, p_kind text, p_planned_seconds int default null, p_status_line text default null
) returns public.sessions
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_prev uuid;
  v_sitting uuid;
  v_planned int := p_planned_seconds;
  v_room public.rooms;
  v_phase text;
  v_left numeric;
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

  select * into v_room from public.rooms where id = p_room_id;
  if v_room.sync_pomodoro and not v_room.is_personal then
    -- Everyone shares one cycle: the server sets the plan to the time left in the focus phase.
    if p_kind <> 'pomodoro' then
      raise exception 'sync_pomodoro_only' using errcode = '22023';
    end if;
    select x.phase, x.left_s into v_phase, v_left
      from private.sync_phase(v_room.sync_epoch, v_room.sync_focus_s, v_room.sync_break_s, now()) x;
    if v_phase = 'focus' then
      v_planned := floor(v_left)::int;
    elsif v_left <= 5 then
      -- Tapped a moment before the shared focus starts: count from now to its end.
      v_planned := ceil(v_left)::int + v_room.sync_focus_s;
    else
      raise exception 'sync_in_break' using errcode = '22023';
    end if;
    if v_planned < 60 then
      raise exception 'sync_phase_ending' using errcode = '22023';
    end if;
  elsif p_kind = 'pomodoro' and (p_planned_seconds is null or p_planned_seconds not between 300 and 7200) then
    raise exception 'invalid_plan' using errcode = '22023';
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
  values (v_uid, p_room_id, coalesce(v_sitting, gen_random_uuid()), p_kind, v_planned,
          nullif(btrim(p_status_line), ''),
          case when p_kind = 'stopwatch' then now() + interval '50 minutes' end)
  returning * into s;

  insert into public.events (user_id, name, props)
  values (v_uid, 'session_started', jsonb_build_object('kind', p_kind, 'sync', coalesce(v_room.sync_pomodoro, false)));
  return s;
end;
$$;

-- Turning sync on, or changing its lengths, restarts the shared cycle now; members refetch on 'sync'.
create or replace function public.set_room(
  p_room_id uuid, p_name text default null, p_station_id text default null,
  p_sync_pomodoro boolean default null, p_sync_focus_s int default null, p_sync_break_s int default null
) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
  v_was boolean;
begin
  perform private.require_role(p_room_id, 'owner', 'mod');
  select sync_pomodoro into v_was from public.rooms where id = p_room_id;
  update public.rooms
     set name = coalesce(nullif(btrim(p_name), ''), name),
         station_id = coalesce(p_station_id, station_id),
         sync_pomodoro = coalesce(p_sync_pomodoro, sync_pomodoro),
         sync_focus_s = coalesce(p_sync_focus_s, sync_focus_s),
         sync_break_s = coalesce(p_sync_break_s, sync_break_s),
         sync_epoch = case when p_sync_focus_s is not null or p_sync_break_s is not null
                             or (p_sync_pomodoro and not v_was)
                           then now() else sync_epoch end
   where id = p_room_id
  returning * into r;
  if p_sync_pomodoro is not null or p_sync_focus_s is not null or p_sync_break_s is not null then
    perform private.broadcast(p_room_id, 'sync', jsonb_build_object('sync_pomodoro', r.sync_pomodoro));
  end if;
  return r;
end;
$$;

-- In sync rooms a break lasts until the shared focus starts again (otherwise up to 15 minutes).
create or replace function public.room_live(p_room_id uuid) returns table (
  user_id uuid, display_name text, avatar jsonb, state text, kind text, started_at timestamptz,
  planned_seconds int, status_line text, sitting_seconds int, break_until timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare v_room public.rooms;
begin
  if not private.am_member(p_room_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  select * into v_room from public.rooms where id = p_room_id;
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
         case when l.status = 'completed' then
           l.ended_at + case when v_room.sync_pomodoro then make_interval(secs => v_room.sync_break_s)
                             else interval '15 minutes' end
         end
    from latest l join public.profiles p on p.id = l.user_id
   where l.status = 'active'
      or (l.kind = 'pomodoro'
          and l.ended_at > now() - case when v_room.sync_pomodoro then make_interval(secs => v_room.sync_break_s)
                                        else interval '15 minutes' end
          and not exists (select 1 from public.sessions a where a.user_id = l.user_id and a.status = 'active'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Tick: only queue pushes people can and want to receive; dispatch any due row
-- ---------------------------------------------------------------------------
create or replace function private.dispatch_queue() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.notify_queue where sent_at is null and send_after <= now()) then
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
  -- 1. Pomodoro end → "Break time" (or "Break together" in sync rooms)
  for r in
    select s.id, s.user_id, s.room_id, s.planned_seconds, rm.sync_pomodoro and not rm.is_personal as sync
      from public.sessions s join public.rooms rm on rm.id = s.room_id
     where s.status = 'active' and s.kind = 'pomodoro'
       and s.started_at + make_interval(secs => s.planned_seconds) <= now()
  loop
    perform private.finish_session(r.id, now());
    if private.wants_push(r.user_id, 'phase_end') then
      insert into public.notify_queue (user_id, kind, payload)
      values (r.user_id, 'phase_end', jsonb_build_object('session_id', r.id, 'room_id', r.room_id, 'sync', r.sync));
    end if;
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
  select user_id, 'checkin', jsonb_build_object('session_id', id, 'room_id', room_id)
    from due where private.wants_push(user_id, 'checkin');
  get diagnostics v_checkins = row_count;

  -- 3. 4h hard cap
  for r in
    select id from public.sessions where status = 'active' and started_at + interval '4 hours' <= now()
  loop
    perform private.finish_session(r.id, now());
    v_done := v_done + 1;
  end loop;

  -- 4. Consent expiry (SPEC §13.1)
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

-- Export includes the devices that can receive pushes.
create or replace function public.export_my_data() returns jsonb
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
    'rooms', coalesce((select jsonb_agg(jsonb_build_object('room', r.name, 'role', m.role, 'joined_at', m.joined_at,
                                                           'notify_active', m.notify_active))
                         from public.room_members m join public.rooms r on r.id = m.room_id where m.user_id = v_uid), '[]'),
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.started_at)
                            from public.sessions s where s.user_id = v_uid), '[]'),
    'blocks', coalesce((select jsonb_agg(b.blocked_id) from public.blocks b where b.blocker_id = v_uid), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('type', r.target_type, 'reason', r.reason, 'at', r.created_at))
                                 from public.reports r where r.reporter_id = v_uid), '[]'),
    'push_devices', coalesce((select jsonb_agg(jsonb_build_object('service', split_part(ps.endpoint, '/', 3), 'added_at', ps.created_at))
                                from public.push_subscriptions ps where ps.user_id = v_uid), '[]'),
    'parental_consent', (select jsonb_build_object('granted_at', c.granted_at, 'expires_at', c.expires_at)
                           from public.parental_consents c where c.user_id = v_uid)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
revoke all on function public.set_room_notify(uuid, boolean) from public, anon;
revoke all on function public.room_info(uuid) from public, anon;
revoke all on function private.valid_push_endpoint(text) from public;
revoke all on function private.wants_push(uuid, text) from public;
revoke all on function private.sync_phase(timestamptz, int, int, timestamptz) from public;
revoke all on function private.enqueue_room_active() from public;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.set_room_notify(uuid, boolean) to authenticated;
grant execute on function public.room_info(uuid) to authenticated;
-- create or replace keeps earlier grants; re-assert the anon lockdown for the replaced functions.
revoke all on function public.start_session(uuid, text, int, text) from public, anon;
revoke all on function public.set_room(uuid, text, text, boolean, int, int) from public, anon;
revoke all on function public.room_live(uuid) from public, anon;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.start_session(uuid, text, int, text) to authenticated;
grant execute on function public.set_room(uuid, text, text, boolean, int, int) to authenticated;
grant execute on function public.room_live(uuid) to authenticated;
grant execute on function public.export_my_data() to authenticated;
