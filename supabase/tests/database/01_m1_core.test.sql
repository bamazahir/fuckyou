begin;
select plan(44);

-- ---------- fixtures ----------
select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'ana@example.com');  -- US 16-17 → not_required
select tests.create_user('00000000-0000-0000-0000-0000000000b2', 'ben@example.com');  -- DE 15 → pending
select tests.create_user('00000000-0000-0000-0000-0000000000c3', 'cy@example.com');   -- IN 16-17 → pending
select tests.create_user('00000000-0000-0000-0000-0000000000d4', 'dee@example.com');  -- ZZ (unlisted) 15 → pending
select tests.create_user('00000000-0000-0000-0000-0000000000e5', 'eli@example.com');  -- under 13
select tests.create_user('00000000-0000-0000-0000-0000000000f6', 'fay@example.com');  -- GB 13 → not_required

-- ---------- structure ----------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'every public table has RLS enabled');

-- ---------- consent decisions (SPEC §13.1) ----------
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select is(public.complete_profile('ana_1', 'Ana', 'us', '16-17', tests.avatar(), 'America/New_York'), 'not_required',
  'US 16-17 needs no parental consent');
select throws_ok($$ select public.complete_profile('ana_2', 'Ana', 'US', '16-17', tests.avatar(), 'UTC') $$,
  'profile_exists', 'a profile can only be completed once');

select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select is(public.complete_profile('ben', 'Ben', 'DE', '15', tests.avatar(), 'Europe/Berlin'), 'pending',
  'DE 15 needs parental consent (consent age 16)');
select tests.act_as('00000000-0000-0000-0000-0000000000c3');
select is(public.complete_profile('cy_k', 'Cy', 'IN', '16-17', tests.avatar(), 'Asia/Kolkata'), 'pending',
  'IN 16-17 needs parental consent (consent age 18)');
select tests.act_as('00000000-0000-0000-0000-0000000000d4');
select is(public.complete_profile('dee', 'Dee', 'ZZ', '15', tests.avatar(), 'UTC'), 'pending',
  'unlisted countries use the default consent age 16');
select tests.act_as('00000000-0000-0000-0000-0000000000f6');
select is(public.complete_profile('fay', 'Fay', 'GB', '13', tests.avatar(), 'Europe/London'), 'not_required',
  'GB 13 needs no parental consent');

select tests.act_as('00000000-0000-0000-0000-0000000000f6');
select throws_ok($$ select public.complete_profile('x', 'X', 'GB', '13', tests.avatar(), 'UTC') $$,
  'profile_exists', 'profile_exists checked before validation');
select tests.act_as('00000000-0000-0000-0000-0000000000e5');
select throws_ok($$ select public.complete_profile('ana_1', 'Eli', 'GB', '13', tests.avatar(), 'UTC') $$,
  'handle_taken', 'handles are unique');
select throws_ok($$ select public.complete_profile('e', 'Eli', 'GB', '13', tests.avatar(), 'UTC') $$,
  'invalid_handle', 'handles are validated with a clear error');
select throws_ok($$ select public.complete_profile('eli', 'Eli', 'GB', 'under_13', tests.avatar(), 'UTC') $$,
  'invalid_age_bracket', 'under-13 cannot complete a profile');
select throws_ok($$ select public.complete_profile('eli', 'Eli', 'GB', '13', '{"colors":{}}', 'UTC') $$,
  '23514', null, 'avatar colors are validated');
select lives_ok($$ select public.reject_underage() $$, 'under-13 signup can be rejected');
select tests.act_as_service();
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000e5'), 0,
  'rejecting an under-13 signup deletes the auth user');

-- ---------- personal room trigger ----------
select is((select count(*)::int from public.rooms where owner_id = '00000000-0000-0000-0000-0000000000a1' and is_personal), 1,
  'a personal room is created with the profile');

-- ---------- RLS: reads ----------
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.profiles), 1, 'users see only their own profile');
select is((select count(*)::int from public.rooms), 1, 'users see only their own rooms');
select is((select count(*)::int from public.events), 0, 'non-admins cannot read events');
select throws_ok($$ select count(*) from public.notify_queue $$, '42501', null, 'clients cannot read the notify queue');

-- ---------- RLS: writes ----------
select throws_ok($$ update public.profiles set is_admin = true $$, '42501', null, 'users cannot make themselves admin');
select throws_ok($$ update public.profiles set consent_status = 'granted' $$, '42501', null,
  'users cannot change their consent status');
select lives_ok($$ update public.profiles set display_name = 'Ana B' $$, 'users can rename themselves');
select throws_ok($$ insert into public.rooms (name, owner_id, tz) values ('Hack', '00000000-0000-0000-0000-0000000000a1', 'UTC') $$,
  '42501', null, 'clients cannot create rooms directly');

-- ---------- sessions ----------
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ select public.start_session((select id from public.rooms limit 1), 'stopwatch') $$,
  'consent_required', 'pending users cannot study');

select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select public.start_session((select id from public.rooms where owner_id = '00000000-0000-0000-0000-0000000000f6'), 'stopwatch') $$,
  'room_not_allowed', 'you cannot study in someone else''s personal room');
select throws_ok($$ select public.start_session((select id from public.rooms limit 1), 'pomodoro') $$,
  '22023', null, 'a pomodoro needs a planned length');
select throws_ok($$ select public.start_session((select id from public.rooms limit 1), 'stopwatch', 1500) $$,
  'stopwatch_has_no_plan', 'a stopwatch has no planned length');

select lives_ok($$ select public.start_session((select id from public.rooms limit 1), 'pomodoro', 1500, ' HL Chem IA ') $$,
  'a pomodoro can start');
select is((select status_line from public.sessions where status = 'active'), 'HL Chem IA', 'status line is trimmed');
select throws_ok($$ update public.sessions set focus_seconds = 99999 $$, '42501', null,
  'clients cannot write durations');
select throws_ok($$ insert into public.sessions (user_id, room_id, sitting_id, kind) select '00000000-0000-0000-0000-0000000000a1', id, gen_random_uuid(), 'stopwatch' from public.rooms limit 1 $$,
  '42501', null, 'clients cannot insert sessions');

-- Pretend the pomodoro started 30 minutes ago, then let tick() finish it.
select tests.act_as_service();
-- Phase-end pushes are only queued for people with a device to send them to (M3).
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-0000-0000-0000000000a1', 'https://fcm.googleapis.com/fcm/send/a1', repeat('A', 87), repeat('B', 22));
update public.sessions set started_at = now() - interval '30 minutes'
 where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'active';
select is((private.tick() ->> 'finished')::int, 1, 'tick finishes an overdue pomodoro');
select is((select focus_seconds from public.sessions where user_id = '00000000-0000-0000-0000-0000000000a1'), 1500,
  'an overdue pomodoro counts exactly its planned length');
select is((select count(*)::int from public.notify_queue where kind = 'phase_end'), 1, 'phase end is queued');
select is((private.tick() ->> 'finished')::int, 0, 'tick is idempotent');

-- Sitting: a new session within 20 minutes in the same room continues the sitting.
update public.sessions set ended_at = now() - interval '5 minutes', started_at = now() - interval '30 minutes'
 where user_id = '00000000-0000-0000-0000-0000000000a1';
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.start_session((select id from public.rooms limit 1), 'stopwatch') $$, 'a stopwatch can start');
select is((select count(distinct sitting_id)::int from public.sessions), 1, 'sessions within 20 minutes share a sitting');

-- Stopwatch check-in: missed check-in completes the session at the due time.
select tests.act_as_service();
update public.sessions set started_at = now() - interval '70 minutes', next_checkin_at = now() - interval '20 minutes'
 where user_id = '00000000-0000-0000-0000-0000000000a1' and status = 'active';
select is((private.tick() ->> 'finished')::int, 1, 'a missed check-in finishes the stopwatch');
select is((select focus_seconds from public.sessions where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'stopwatch'),
  3000, 'it counts time up to the missed check-in only');

-- end_session is idempotent and notes work once.
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.end_session((select id from public.sessions where kind = 'stopwatch')) $$,
  'ending an already-finished session is harmless');
select is(public.submit_note((select id from public.sessions where kind = 'stopwatch'), '  finished data tables  ', true), 0,
  'a note can be added');
select throws_ok($$ select public.submit_note((select id from public.sessions where kind = 'stopwatch'), 'again', false) $$,
  'note_not_possible', 'a note can only be added once');
select throws_ok($$ select public.log_event('session_completed', '{}') $$, 'event_not_allowed',
  'clients cannot forge server-side events');
select throws_ok($$ select public.log_event('app_open', '{"x":"free text here!"}') $$, 'invalid_props',
  'event props cannot contain free text');

select * from finish();
rollback;
