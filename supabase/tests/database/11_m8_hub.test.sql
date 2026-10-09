begin;
select plan(24);

-- fixtures: Ada (16-17, owner), Ben (16-17), Cy (14), Dee (16-17, blocked by Ada)
select tests.create_user('00000000-0000-0000-0000-0000000000a1', 'ada@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000a2', 'ben@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000a3', 'cy@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000a4', 'dee@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000a5', 'eve@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000a6', 'fay@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000a7', 'gus@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select public.complete_profile('ada', 'Ada', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select public.complete_profile('ben', 'Ben', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000a3');
select public.complete_profile('cyy', 'Cy', 'GB', '14', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000a4');
select public.complete_profile('dee', 'Dee', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000a5');
select public.complete_profile('eve', 'Eve', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000a6');
select public.complete_profile('fay', 'Fay', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000a7');
select public.complete_profile('gus', 'Gus', 'GB', '18+', tests.avatar(), 'Europe/London');

-- ---------- fuller rooms ----------
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.inventory), 14, 'new accounts own the fuller starter room (14 things)');
create temp table t_room as select * from public.create_room('Hub crew', 'Europe/London');
grant select on t_room to authenticated;
select is((select qty from public.room_inventory where room_id = (select id from t_room) and item_id = 'plant_pot'), 2,
  'new shared rooms get plants, lamps, beanbags and wall things too');

-- ---------- expressions ----------
select lives_ok($$ update public.profiles set avatar = avatar || '{"expression":"cheeky"}' where id = auth.uid() $$,
  'a bean can pick an expression');
select throws_ok($$ update public.profiles set avatar = avatar || '{"expression":"evil"}' where id = auth.uid() $$,
  '23514', null, 'only known expressions');

-- ---------- room style ----------
select lives_ok($$ select public.set_room_style((select id from t_room), 'sage', 'walnut') $$, 'owners pick walls and floor');
select is((public.room_info((select id from t_room)) -> 'style' ->> 'wall'), 'sage', 'members see the style');
select throws_ok($$ select public.set_room_style((select id from t_room), 'neon', 'oak') $$, 'invalid_style',
  'only known finishes');
select lives_ok($$ select public.set_room_style((select id from public.rooms where owner_id = auth.uid() and is_personal), 'sky', 'birch') $$,
  'and you style your own room');

-- ---------- discover ----------
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.discover_rooms()), 0, 'unlisted rooms are not discoverable');
select throws_ok($$ select public.set_room_listed((select id from t_room), true) $$, 'not_allowed',
  'only the owner can list a room');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select public.block_user('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$ select public.set_room_listed((select id from t_room), true) $$, 'too_few_to_list',
  'a room needs 3 members to be listed');
select tests.act_as('00000000-0000-0000-0000-0000000000a5');
select public.join_room((select invite_code from t_room));
select tests.act_as('00000000-0000-0000-0000-0000000000a6');
select public.join_room((select invite_code from t_room));
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select public.set_room_listed((select id from t_room), true);
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select is((select name from public.discover_rooms() limit 1), 'Hub crew', 'listed rooms show up for people the same age');
select tests.act_as('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.discover_rooms()), 0, 'but not for younger (or older) people');
select throws_ok($$ select public.join_listed_room((select id from t_room)) $$, 'room_not_found',
  'and they can''t join it by id either');
select tests.act_as('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from public.discover_rooms()), 0, 'nor for someone a member has blocked');
select tests.act_as('00000000-0000-0000-0000-0000000000a7');
select throws_ok($$ select public.join_room((select invite_code from t_room)) $$, 'listed_age_group',
  'a passed-on invite code doesn''t let an adult into a listed teen room');
select is(public.preview_room((select invite_code from t_room)) -> 'studying', '[]'::jsonb,
  'a listed room''s invite preview shows no names or faces');
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select is((select studying_count from public.discover_rooms() limit 1), null,
  'small rooms don''t show when people are studying');
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select is(public.join_listed_room((select id from t_room)) - 'id', '{"name":"Hub crew"}'::jsonb,
  'joining a listed room works and gives back only its name and id');
select is((select count(*)::int from public.discover_rooms()), 0, 'rooms you''re in drop out of Discover');

-- ---------- moving rooms ----------
select public.start_session((select id from public.rooms where owner_id = auth.uid() and is_personal), 'stopwatch');
select is((public.move_session((select id from t_room))).room_id, (select id from t_room),
  'a running session can move to another of your rooms');
select tests.act_as('00000000-0000-0000-0000-0000000000a1');
select public.set_room((select id from t_room), p_sync_pomodoro => true);
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select public.move_session((select id from public.rooms where owner_id = auth.uid() and is_personal));
select throws_ok($$ select public.move_session((select id from t_room)) $$, 'sync_room_move',
  'but not into a room running a shared pomodoro');
select tests.act_as('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select public.move_session((select id from t_room)) $$, 'room_not_allowed',
  'nor into a room you''re not in');

-- ---------- stats ----------
select tests.act_as('00000000-0000-0000-0000-0000000000a2');
select is(jsonb_array_length(public.my_stats() -> 'hours'), 24, 'my_stats has hours, days and totals');

select * from finish();
rollback;
