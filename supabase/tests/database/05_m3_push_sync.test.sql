begin;
select plan(33);

-- ---------- fixtures: owner Oki, members Mo and Bea, outsider Zed ----------
select tests.create_user('00000000-0000-0000-0000-0000000000e1', 'oki@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000e2', 'mo@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000e3', 'bea@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000e4', 'zed@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000e1');
select public.complete_profile('oki', 'Oki', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000e2');
select public.complete_profile('moe', 'Mo', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000e3');
select public.complete_profile('bea', 'Bea', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000e4');
select public.complete_profile('zed', 'Zed', 'GB', '16-17', tests.avatar(), 'Europe/London');

select tests.act_as('00000000-0000-0000-0000-0000000000e1');
create temp table t_room as select * from public.create_room('Push crew', 'Europe/London');
grant select on t_room to authenticated;
select tests.act_as('00000000-0000-0000-0000-0000000000e2');
select public.join_room((select invite_code from t_room));
select tests.act_as('00000000-0000-0000-0000-0000000000e3');
select public.join_room((select invite_code from t_room));

-- ---------- push subscriptions ----------
select tests.act_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok(
  $$ select public.save_push_subscription('https://evil.example.com/hook', tests.push_key(), tests.push_auth()) $$,
  'invalid_push_endpoint', 'only real push services are accepted (no SSRF targets)');
select lives_ok(
  $$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/mo-1', tests.push_key(), tests.push_auth()) $$,
  'a browser push subscription is saved');
select lives_ok(
  $$ select public.save_push_subscription('https://web.push.apple.com/QmoIphone', tests.push_key('ef'), tests.push_auth()) $$,
  'an iOS endpoint is accepted too');
select is((select count(*)::int from public.push_subscriptions), 2, 'you see your own devices');
select throws_ok(
  $$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
     values (auth.uid(), 'https://fcm.googleapis.com/fcm/send/x', tests.push_key(), tests.push_auth()) $$,
  '42501', null, 'no direct writes');
select tests.act_as('00000000-0000-0000-0000-0000000000e4');
select is((select count(*)::int from public.push_subscriptions), 0, 'nobody else sees them');
select public.delete_push_subscription('https://fcm.googleapis.com/fcm/send/mo-1');
select tests.act_as('00000000-0000-0000-0000-0000000000e2');
select is((select count(*)::int from public.push_subscriptions), 2, 'others cannot delete your devices');
select public.delete_push_subscription('https://web.push.apple.com/QmoIphone');
select is((select count(*)::int from public.push_subscriptions), 1, 'you can remove a device (sign-out)');
select tests.act_as('00000000-0000-0000-0000-0000000000e3');
select public.save_push_subscription('https://web.push.apple.com/QmoIphone', tests.push_key('ef'), tests.push_auth());
select is((select count(*)::int from public.push_subscriptions), 1, 'a shared device moves to whoever subscribes');
select throws_ok(
  $$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/bad', repeat('A', 87), tests.push_auth()) $$,
  'invalid_push_keys', 'keys that are not a real P-256 point are refused');

-- ---------- room is active ----------
select tests.act_as('00000000-0000-0000-0000-0000000000e2');
select public.set_room_notify((select id from t_room), true);
select tests.act_as('00000000-0000-0000-0000-0000000000e3');
select public.set_room_notify((select id from t_room), true);
select public.block_user('00000000-0000-0000-0000-0000000000e1');
select tests.act_as('00000000-0000-0000-0000-0000000000e4');
select throws_ok($$ select public.set_room_notify((select id from t_room), true) $$, 'not_a_member',
  'outsiders cannot opt in');

select tests.act_as('00000000-0000-0000-0000-0000000000e1');
select public.start_session((select id from t_room), 'pomodoro', 1500, null);
select tests.act_as_service();
select is((select count(*)::int from public.notify_queue
            where kind = 'room_active' and user_id = '00000000-0000-0000-0000-0000000000e2'), 1,
  'an opted-in member with a device hears that the room is active');
select is((select payload ->> 'name' from public.notify_queue where kind = 'room_active' limit 1), 'Oki',
  'it says who started');
select is((select count(*)::int from public.notify_queue
            where kind = 'room_active' and user_id = '00000000-0000-0000-0000-0000000000e3'), 0,
  'not if you blocked the person who started');
select is((select count(*)::int from public.notify_queue
            where kind = 'room_active' and user_id = '00000000-0000-0000-0000-0000000000e1'), 0,
  'never to the starter');
select tests.act_as('00000000-0000-0000-0000-0000000000e1');
select public.start_session((select id from t_room), 'pomodoro', 1500, null);
select tests.act_as_service();
select is((select count(*)::int from public.notify_queue where kind = 'room_active'), 1,
  'at most one per room every 2 hours');
-- The push function clears payloads once sent; the 2-hour limit must still hold afterwards.
update public.notify_queue set sent_at = now(), payload = '{}' where kind = 'room_active';
select tests.act_as('00000000-0000-0000-0000-0000000000e1');
select public.start_session((select id from t_room), 'pomodoro', 1500, null);
select tests.act_as_service();
select is((select count(*)::int from public.notify_queue where kind = 'room_active'), 1,
  'still at most one after it was sent');

-- ---------- notification preferences ----------
update public.profiles set settings = '{"notify":{"phase_end":false}}' where id = '00000000-0000-0000-0000-0000000000e2';
select is(private.wants_push('00000000-0000-0000-0000-0000000000e2', 'phase_end'), false, 'a type can be switched off');
select is(private.wants_push('00000000-0000-0000-0000-0000000000e2', 'checkin'), true, 'others stay on');
update public.profiles set settings = '{"notify":{"phase_end":"maybe"}}' where id = '00000000-0000-0000-0000-0000000000e2';
select is(private.wants_push('00000000-0000-0000-0000-0000000000e2', 'phase_end'), true,
  'a malformed setting can''t break the tick (it just means on)');
select is(private.wants_push('00000000-0000-0000-0000-0000000000e4', 'checkin'), false, 'no device, no push');

-- ---------- synced pomodoro ----------
select is((select phase || ':' || left_s::int from private.sync_phase('2026-10-10 10:00Z', 1500, 300, '2026-10-10 10:10Z')),
  'focus:900', 'phase math: 10 min into focus');
select is((select phase || ':' || left_s::int from private.sync_phase('2026-10-10 10:00Z', 1500, 300, '2026-10-10 10:27Z')),
  'break:180', 'phase math: 2 min into the break');
select is((select phase || ':' || left_s::int from private.sync_phase('2026-10-10 10:00Z', 1500, 300, '2026-10-10 09:59:50Z')),
  'break:10', 'phase math: before the epoch wraps around');

select tests.act_as('00000000-0000-0000-0000-0000000000e1');
select public.set_room((select id from t_room), p_sync_pomodoro => true);
select tests.act_as_service();
update public.rooms set sync_epoch = now() - interval '10 minutes' where id = (select id from t_room);
select tests.act_as('00000000-0000-0000-0000-0000000000e2');
select is((public.start_session((select id from t_room), 'pomodoro', 3000, null)).planned_seconds, 900,
  'joining a shared focus runs to the end of the phase, whatever the client asked');
select throws_ok($$ select public.start_session((select id from t_room), 'stopwatch') $$, 'sync_pomodoro_only',
  'no stopwatch in sync rooms');
select tests.act_as_service();
update public.rooms set sync_epoch = now() - interval '1600 seconds' where id = (select id from t_room);
select tests.act_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok($$ select public.start_session((select id from t_room), 'pomodoro', 1500, null) $$, 'sync_in_break',
  'during the shared break you wait for the next focus');
select is((public.room_info((select id from t_room)) ->> 'sync_pomodoro')::boolean, true,
  'members can read the room''s sync settings');

-- ---------- queue claiming ----------
select tests.act_as_service();
insert into public.notify_queue (user_id, kind, payload, created_at)
values ('00000000-0000-0000-0000-0000000000e2', 'phase_end', '{}', now() - interval '20 minutes');
select is((select count(*)::int from public.claim_notifications(50)), 1, 'claiming returns due rows, not stale ones');
select is((select count(*)::int from public.claim_notifications(50)), 0, 'a second caller gets nothing (no double sends)');
select is((select count(*)::int from public.notify_queue where kind = 'phase_end' and sent_at is null), 0,
  'stale pushes are retired');
select tests.act_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok($$ select public.claim_notifications(5) $$, '42501', null, 'clients cannot claim notifications');

-- ---------- start rate limit ----------
select tests.act_as('00000000-0000-0000-0000-0000000000e4');
select public.start_session((select id from public.rooms where owner_id = auth.uid() and is_personal), 'stopwatch')
  from generate_series(1, 30);
select throws_ok(
  $$ select public.start_session((select id from public.rooms where owner_id = auth.uid() and is_personal), 'stopwatch') $$,
  'rate_limited', 'starting sessions is rate-limited (each start can notify a room)');

select * from finish();
rollback;
