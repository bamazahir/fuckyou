begin;
select plan(65);

-- ---------- fixtures: owner Olu, member Mia, outsider Xan, pending teen Pip, admin Ada ----------
select tests.create_user('00000000-0000-0000-0000-00000000000a', 'olu@example.com');
select tests.create_user('00000000-0000-0000-0000-00000000000b', 'mia@example.com');
select tests.create_user('00000000-0000-0000-0000-00000000000c', 'xan@example.com');
select tests.create_user('00000000-0000-0000-0000-00000000000d', 'pip@example.com');
select tests.create_user('00000000-0000-0000-0000-00000000000e', 'ada@example.com');
select tests.create_user('00000000-0000-0000-0000-00000000000f', 'sam@example.com');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.complete_profile('olu', 'Olu', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select public.complete_profile('mia', 'Mia', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select public.complete_profile('xan', 'Xan', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-00000000000d');
select public.complete_profile('pip', 'Pip', 'DE', '14', tests.avatar(), 'Europe/Berlin');
select tests.act_as('00000000-0000-0000-0000-00000000000e');
select public.complete_profile('ada', 'Ada', 'GB', '18+', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-00000000000f');
select public.complete_profile('sam', 'Sam', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as_service();
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

-- ---------- what signed-out visitors may call ----------
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  array['consent_decide', 'consent_view', 'health', 'preview_room', 'server_time'],
  'anon can execute only the public-page functions');

-- ---------- profanity filter ----------
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$ update public.profiles set display_name = 'fuck off' $$, 'inappropriate_text',
  'display names are filtered on every write path');
select lives_ok($$ update public.profiles set display_name = 'Class Assignment' $$,
  'words that merely contain a blocked word are fine');
select tests.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.create_room('sh1t room', 'UTC') $$, 'inappropriate_text', 'room names are filtered');
select throws_ok($$ select public.start_session((select id from public.rooms where is_personal), 'stopwatch', null, 'b!tch please') $$,
  'inappropriate_text', 'status lines are filtered');

-- ---------- create / preview / join ----------
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.create_room('IB Chem', 'Europe/London') $$, 'an active user can create a room');
select is((select role from public.room_members where user_id = '00000000-0000-0000-0000-00000000000a'), 'owner',
  'the creator is the owner');
select tests.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok($$ select public.create_room('Teen room', 'UTC') $$, 'consent_required', 'pending users cannot create rooms');

-- share the invite code via a temp table readable by everyone in this transaction
select tests.act_as_service();
create temp table t_room as select id, invite_code from public.rooms where name = 'IB Chem';
grant select on t_room to anon, authenticated;

set local role anon;
select is((public.preview_room((select invite_code from t_room)) ->> 'name'), 'IB Chem',
  'anyone with the link can preview the room');
select is((public.preview_room(lower((select invite_code from t_room))) ->> 'member_count')::int, 1,
  'invite codes are case-insensitive');
select throws_ok($$ select public.preview_room('NOPE0000') $$, 'room_not_found', 'unknown codes are rejected');
select throws_ok($$ select public.join_room((select invite_code from t_room)) $$, '42501', null,
  'anon cannot join');

select tests.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.join_room((select invite_code from t_room)) $$, 'a user joins with the code');
select lives_ok($$ select public.join_room((select invite_code from t_room)) $$, 'joining twice is harmless');
select is((select count(*)::int from public.room_members where room_id = (select id from t_room)), 1,
  'members only read their own membership rows');
select is((select count(*)::int from public.room_members_list((select id from t_room))), 2, 'members list shows both');
select tests.act_as('00000000-0000-0000-0000-00000000000f');
select lives_ok($$ select public.join_room((select invite_code from t_room)) $$, 'a third user joins');

-- ---------- visibility ----------
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.rooms where id = (select id from t_room)), 0, 'outsiders cannot see the room');
select throws_ok($$ select * from public.room_live((select id from t_room)) $$, 'not_a_member', 'outsiders cannot see who is studying');
select throws_ok($$ select * from public.leaderboard((select id from t_room), 'week') $$, 'not_a_member',
  'outsiders cannot see leaderboards');
select throws_ok($$ select public.start_session((select id from t_room), 'stopwatch') $$, 'room_not_allowed',
  'outsiders cannot study in the room');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from public.rooms where id = (select id from t_room)), 1, 'members can see the room');
select is((select count(*)::int from public.profiles), 1, 'roommates'' profile rows stay private');

-- ---------- live state + leaderboards ----------
select lives_ok($$ select public.start_session((select id from t_room), 'pomodoro', 1500, 'Kinetics') $$, 'a member studies in the room');
select tests.act_as_service();
update public.sessions set started_at = now() - interval '10 minutes' where user_id = '00000000-0000-0000-0000-00000000000b' and status = 'active';
-- Olu: a finished hour earlier this week in the room, plus 30 min solo in the personal room
insert into public.sessions (user_id, room_id, sitting_id, kind, status, started_at, ended_at, focus_seconds)
select '00000000-0000-0000-0000-00000000000a', (select id from t_room), gen_random_uuid(), 'stopwatch', 'completed',
       now() - interval '3 hours', now() - interval '2 hours', 3600;
insert into public.sessions (user_id, room_id, sitting_id, kind, status, started_at, ended_at, focus_seconds)
select '00000000-0000-0000-0000-00000000000a', r.id, gen_random_uuid(), 'stopwatch', 'completed',
       now() - interval '5 hours', now() - interval '4 hours 30 minutes', 1800
  from public.rooms r where r.owner_id = '00000000-0000-0000-0000-00000000000a' and r.is_personal;

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select is((select studying_count from public.my_rooms() where id = (select id from t_room)), 1, 'my_rooms shows live counts');
select is((select count(*)::int from public.my_rooms()), 1, 'my_rooms lists only shared rooms I belong to');
select is((select count(*)::int from public.room_live((select id from t_room))), 1, 'room_live shows the one person studying');
select is((select state from public.room_live((select id from t_room))), 'focus', 'their state is focus');
select is((select status_line from public.room_live((select id from t_room))), 'Kinetics', 'with their status line');
select is((select sitting_seconds from public.room_live((select id from t_room))), 600, 'and their sitting so far');
select is((select seconds from public.leaderboard((select id from t_room), 'live') where display_name = 'Mia'), 600,
  'live tab counts the current sitting');
select is((select count(*)::int from public.leaderboard((select id from t_room), 'live')), 1,
  'live tab only lists people in a sitting');
select is((select seconds from public.leaderboard((select id from t_room), 'alltime') where display_name = 'Olu'), 3600,
  'all-time counts only this room');
select is((select seconds from public.leaderboard((select id from t_room), 'lifetime') where display_name = 'Olu'), 5400,
  'lifetime counts every room');
select is((select rank from public.leaderboard((select id from t_room), 'alltime') where display_name = 'Olu'), 1,
  'ranks by seconds');
select is((select is_present from public.leaderboard((select id from t_room), 'alltime') where display_name = 'Mia'), true,
  'is_present marks who is studying now');
select throws_ok($$ select * from public.leaderboard((select id from t_room), 'global') $$, 'invalid_tab', 'no global board');

-- ---------- roles & moderation ----------
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.regen_invite((select id from t_room)) $$, 'not_allowed', 'members cannot regenerate invites');
select throws_ok($$ select public.remove_member((select id from t_room), '00000000-0000-0000-0000-00000000000f') $$,
  'not_allowed', 'members cannot remove people');
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.set_role((select id from t_room), '00000000-0000-0000-0000-00000000000b', 'mod') $$,
  'the owner can make a mod');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.set_role((select id from t_room), '00000000-0000-0000-0000-00000000000f', 'mod') $$,
  'not_allowed', 'mods cannot hand out roles');
select isnt((select public.regen_invite((select id from t_room))), (select invite_code from t_room), 'mods can regenerate the invite');
select tests.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.join_room((select invite_code from t_room)) $$, 'room_not_found', 'the old invite link dies');

-- void: Olu voids Sam's session
select tests.act_as_service();
insert into public.sessions (id, user_id, room_id, sitting_id, kind, status, started_at, ended_at, focus_seconds)
select '00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-00000000000f', (select id from t_room), gen_random_uuid(),
       'stopwatch', 'completed', now() - interval '2 hours', now() - interval '1 hour', 3600;
select tests.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.void_session('00000000-0000-0000-0000-0000000005a1', 'mine now') $$, 'not_allowed',
  'members cannot void sessions');
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.void_session('00000000-0000-0000-0000-0000000005a1', 'x') $$, 'invalid_reason', 'a void needs a reason');
select lives_ok($$ select public.void_session('00000000-0000-0000-0000-0000000005a1', 'left the timer running') $$, 'owners can void');
select is((select count(*)::int from public.leaderboard((select id from t_room), 'alltime') where display_name = 'Sam'), 0,
  'voided time leaves the leaderboard');
select tests.act_as('00000000-0000-0000-0000-00000000000f');
select is((select void_reason from public.sessions where id = '00000000-0000-0000-0000-0000000005a1'), 'left the timer running',
  'the member can see why');
select tests.act_as_service();
insert into public.sessions (user_id, room_id, sitting_id, kind, status, started_at, ended_at, focus_seconds)
select '00000000-0000-0000-0000-00000000000f', (select id from t_room), gen_random_uuid(), 'stopwatch', 'completed',
       now() - make_interval(hours => h + 3), now() - make_interval(hours => h + 2), 3600
  from generate_series(1, 2) as h;
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.void_session(s.id, 'again a running timer')
  from public.room_member_sessions((select id from t_room), '00000000-0000-0000-0000-00000000000f') s where s.status = 'completed';
select tests.act_as_service();
select is((select count(*)::int from public.reports where target_type = 'void' and reporter_id is null), 1,
  'three voids against one member in 7 days auto-file a report for the admin');

-- remove (ban) Sam
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.remove_member((select id from t_room), '00000000-0000-0000-0000-00000000000f') $$, 'mods can remove members');
select tests.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.start_session((select id from t_room), 'stopwatch') $$, 'room_not_allowed', 'removed members cannot study');
select tests.act_as_service();
create temp table t_code as select invite_code from public.rooms where id = (select id from t_room);
grant select on t_code to authenticated;
select tests.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok($$ select public.join_room((select invite_code from t_code)) $$, 'banned_from_room', 'removed members cannot rejoin');

-- ---------- block / report / admin ----------
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.block_user('00000000-0000-0000-0000-00000000000a') $$, 'users can block');
select is((select count(*)::int from public.blocks), 1, 'and see their blocks');
select lives_ok($$ select public.report('user', '00000000-0000-0000-0000-00000000000a', (select id from t_room), 'harassment', 'mean nudges') $$,
  'members can report');
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.room_reports((select id from t_room)) where reason = 'harassment'), 0, 'owners don''t see reports about themselves');
select throws_ok($$ select * from public.admin_list_reports() $$, 'not_allowed', 'only the admin sees the queue');
select tests.act_as('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.admin_list_reports()), 2, 'the admin sees every open report, incl. auto-filed');
select lives_ok($$ select public.admin_resolve_report((select id from public.admin_list_reports() where reason = 'harassment'), 'remove_content') $$,
  'the admin can remove reported content');
select tests.act_as_service();
select is((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'Renamed user',
  'removing a reported name renames the user');

-- ---------- ownership hand-over on account deletion ----------
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ select public.leave_room((select id from t_room)) $$, 'owner_must_transfer', 'owners must hand over before leaving');
select lives_ok($$ select public.delete_my_account() $$, 'users can delete their account');
select tests.act_as_service();
select is((select owner_id from public.rooms where id = (select id from t_room)), '00000000-0000-0000-0000-00000000000b'::uuid,
  'the room passes to the longest-standing mod');
select is((select count(*)::int from public.sessions where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'a deleted account leaves no sessions behind');

-- ---------- export ----------
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select ok((public.export_my_data() -> 'sessions') is not null and (public.export_my_data() ->> 'profile') is not null,
  'users can export their data');

select * from finish();
rollback;
