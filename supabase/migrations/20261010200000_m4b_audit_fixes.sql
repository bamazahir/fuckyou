-- Fixes from the M4 ship audit (docs/audits/2026-10-10-M4.md): tick resilience, the room-active
-- 2h limit, start rate limit, push key validation, an atomic queue claim and stricter avatars.

-- #1: never cast user-controlled settings; compare as JSON (a bad value now just means "on").
create or replace function private.wants_push(p_uid uuid, p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.push_subscriptions s where s.user_id = p_uid)
     and coalesce((select p.settings #> array['notify', p_kind] from public.profiles p where p.id = p_uid), 'true'::jsonb)
         <> 'false'::jsonb
$$;

-- #2: the room_active dedupe needs a room id that survives sending (the payload is cleared then).
alter table public.notify_queue add column room_id uuid references public.rooms (id) on delete cascade;
update public.notify_queue set room_id = (payload ->> 'room_id')::uuid
 where kind = 'room_active' and payload ->> 'room_id' ~ '^[0-9a-f-]{36}$';
create index notify_queue_room_active_idx on public.notify_queue (user_id, room_id, created_at) where kind = 'room_active';

create or replace function private.enqueue_room_active() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select is_personal from public.rooms where id = new.room_id) then
    return new;
  end if;
  insert into public.notify_queue (user_id, kind, room_id, payload)
  select m.user_id, 'room_active', new.room_id,
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
                      where q.user_id = m.user_id and q.kind = 'room_active' and q.room_id = new.room_id
                        and q.created_at > now() - interval '2 hours');
  return new;
end;
$$;

-- #2: starting a session is rate-limited (each start can notify a whole room).
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
  -- Each start can notify a room; cap how fast anyone can start (audit 2026-10-10 #2).
  if private.over_limit('start', 30, 600) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
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


-- #3: keys must decode to a real P-256 point (65 bytes, 0x04 first) and a 16-byte auth secret.
create function private.b64url_bytes(p text) returns bytea
language plpgsql immutable set search_path = '' as $$
declare v text := translate(rtrim(p, '='), '-_', '+/');
begin
  return decode(v || repeat('=', (4 - length(v) % 4) % 4), 'base64');
exception when others then
  return null;
end;
$$;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_key bytea := private.b64url_bytes(coalesce(p_p256dh, ''));
begin
  if not private.valid_push_endpoint(coalesce(p_endpoint, '')) then
    raise exception 'invalid_push_endpoint' using errcode = '22023';
  end if;
  if v_key is null or length(v_key) <> 65 or get_byte(v_key, 0) <> 4
     or coalesce(length(private.b64url_bytes(coalesce(p_auth, ''))), 0) <> 16 then
    raise exception 'invalid_push_keys' using errcode = '22023';
  end if;
  -- A shared device that switches accounts moves the endpoint to whoever is signed in now.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh,
                                       auth = excluded.auth, created_at = now();
  delete from public.push_subscriptions
   where user_id = v_uid
     and id not in (select id from public.push_subscriptions where user_id = v_uid order by created_at desc limit 10);
end;
$$;

-- #8: the push function claims rows atomically, so overlapping calls never send one twice. Stale
-- pushes (a "break time" 10 minutes late is noise) are retired here instead of being sent.
create function public.claim_notifications(p_limit int default 50) returns setof public.notify_queue
language plpgsql security definer set search_path = '' as $$
begin
  update public.notify_queue set sent_at = now(), payload = '{}'
   where sent_at is null and kind in ('phase_end', 'checkin', 'room_active')
     and created_at < now() - case when kind = 'room_active' then interval '30 minutes' else interval '10 minutes' end;
  return query
  update public.notify_queue q set send_after = now() + interval '2 minutes'
   where q.id in (select x.id from public.notify_queue x
                   where x.sent_at is null and x.send_after <= now()
                   order by x.id limit least(greatest(coalesce(p_limit, 50), 1), 100)
                   for update skip locked)
  returning q.*;
end;
$$;

-- #11: avatars may only hold the known fields (no hidden free text shared with every room member).
create or replace function private.valid_avatar(a jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(a) = 'object'
    and (select bool_and(k in ('colors', 'hair', 'outfit', 'accessories')) from jsonb_object_keys(a) k)
    and jsonb_typeof(a -> 'colors') = 'object'
    and (select bool_and(k in ('body', 'skin', 'hair', 'top', 'accent')) from jsonb_object_keys(a -> 'colors') k)
    and (select bool_and(coalesce(a -> 'colors' ->> k, '') ~ '^#[0-9a-fA-F]{6}$')
           from unnest(array['body', 'skin', 'hair', 'top']) as k)
    and (a -> 'colors' -> 'accent' is null or coalesce(a -> 'colors' ->> 'accent', '') ~ '^#[0-9a-fA-F]{6}$')
    and (a -> 'hair' is null or coalesce(a ->> 'hair', '') in ('short', 'long', 'curly', 'bun'))
    and (a -> 'outfit' is null or (
          jsonb_typeof(a -> 'outfit') = 'object'
          and (select coalesce(bool_and(k in ('top', 'bottom')), true) from jsonb_object_keys(a -> 'outfit') k)
          and (a -> 'outfit' -> 'top' is null or coalesce(a -> 'outfit' ->> 'top', '') in ('tee', 'hoodie', 'stripes', 'collar'))
          and (a -> 'outfit' -> 'bottom' is null or coalesce(a -> 'outfit' ->> 'bottom', '') in ('trousers', 'shorts', 'skirt'))))
    and (a -> 'accessories' is null or (
          jsonb_typeof(a -> 'accessories') = 'array'
          and jsonb_array_length(a -> 'accessories') <= 4
          and (select coalesce(bool_and(jsonb_typeof(x) = 'string'
                                        and x #>> '{}' in ('beanie', 'cap', 'bow', 'glasses', 'headphones', 'scarf')), true)
                 from jsonb_array_elements(a -> 'accessories') as x)
          and (select count(*) from jsonb_array_elements_text(a -> 'accessories') as x
                where x in ('beanie', 'cap', 'bow')) <= 1
          and (select count(*) from jsonb_array_elements_text(a -> 'accessories') as x)
            = (select count(distinct x) from jsonb_array_elements_text(a -> 'accessories') as x)))
    and pg_column_size(a) < 2048,
    false)
$$;

-- #1 and #12: each tick step is isolated, so one bad row can't stall the rest; a pomodoro the client
-- already ended (a race with end_session) is skipped instead of getting a "Break time" push.
create or replace function private.tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_done int := 0;
  v_checkins int := 0;
  v_expired int := 0;
  v_failed int := 0;
begin
  -- 1. Pomodoro end
  for r in
    select s.id, s.user_id, s.room_id, rm.sync_pomodoro and not rm.is_personal as sync
      from public.sessions s join public.rooms rm on rm.id = s.room_id
     where s.status = 'active' and s.kind = 'pomodoro'
       and s.started_at + make_interval(secs => s.planned_seconds) <= now()
  loop
    begin
      perform 1 from public.sessions where id = r.id and status = 'active' for update skip locked;
      if found then
        perform private.finish_session(r.id, now());
        if private.wants_push(r.user_id, 'phase_end') then
          insert into public.notify_queue (user_id, kind, room_id, payload)
          values (r.user_id, 'phase_end', r.room_id,
                  jsonb_build_object('session_id', r.id, 'room_id', r.room_id, 'sync', r.sync));
        end if;
        v_done := v_done + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
      raise warning 'tick: pomodoro % failed: %', r.id, sqlerrm;
    end;
  end loop;

  -- 2a. Check-in missed: complete at the time the check-in was due
  for r in
    select id, next_checkin_at from public.sessions
     where status = 'active' and kind = 'stopwatch' and next_checkin_at + interval '10 minutes' <= now()
  loop
    begin
      perform private.finish_session(r.id, r.next_checkin_at);
      v_done := v_done + 1;
    exception when others then
      v_failed := v_failed + 1;
      raise warning 'tick: check-in % failed: %', r.id, sqlerrm;
    end;
  end loop;

  -- 2b. Check-in due: ask once
  for r in
    update public.sessions set checkin_notified = true
     where status = 'active' and kind = 'stopwatch' and not checkin_notified and next_checkin_at <= now()
    returning id, user_id, room_id
  loop
    begin
      if private.wants_push(r.user_id, 'checkin') then
        insert into public.notify_queue (user_id, kind, room_id, payload)
        values (r.user_id, 'checkin', r.room_id, jsonb_build_object('session_id', r.id, 'room_id', r.room_id));
        v_checkins := v_checkins + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
      raise warning 'tick: check-in push % failed: %', r.id, sqlerrm;
    end;
  end loop;

  -- 3. 4h hard cap
  for r in
    select id from public.sessions where status = 'active' and started_at + interval '4 hours' <= now()
  loop
    begin
      perform private.finish_session(r.id, now());
      v_done := v_done + 1;
    exception when others then
      v_failed := v_failed + 1;
      raise warning 'tick: cap % failed: %', r.id, sqlerrm;
    end;
  end loop;

  -- 4. Consent expiry (SPEC §13.1)
  for r in
    select p.id from public.profiles p
      left join public.parental_consents c on c.user_id = p.id
     where p.consent_status = 'pending'
       and coalesce(c.expires_at, p.created_at + interval '7 days') <= now()
  loop
    begin
      perform private.delete_user(r.id);
      v_expired := v_expired + 1;
    exception when others then
      v_failed := v_failed + 1;
      raise warning 'tick: consent expiry % failed: %', r.id, sqlerrm;
    end;
  end loop;

  begin
    perform private.dispatch_queue();
  exception when others then
    raise warning 'tick: dispatch failed: %', sqlerrm;
  end;
  return jsonb_build_object('finished', v_done, 'checkins', v_checkins, 'consent_expired', v_expired, 'failed', v_failed);
end;
$$;

revoke all on function public.claim_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_notifications(int) to service_role;
revoke all on function private.b64url_bytes(text) from public;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
revoke all on function public.start_session(uuid, text, int, text) from public, anon;
grant execute on function public.start_session(uuid, text, int, text) to authenticated;
