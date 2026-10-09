begin;
select plan(6);

select tests.create_user('00000000-0000-0000-0000-0000000000f1', 'ria@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000f2', 'tom@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000f1');
select public.complete_profile('ria', 'Ria', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000f2');
select public.complete_profile('tom', 'Tom', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000f1');
create temp table t_room as select * from public.create_room('Radio crew', 'Europe/London');
grant select on t_room to authenticated;
select tests.act_as('00000000-0000-0000-0000-0000000000f2');
select public.join_room((select invite_code from t_room));

select is(public.room_info((select id from t_room)) ->> 'station_id', 'rain',
  'new rooms play Rain (lofi has no tracks yet)');
select throws_ok($$ select public.set_room((select id from t_room), p_station_id => 'cafe') $$, 'not_allowed',
  'members can''t change the station');
select tests.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select public.set_room((select id from t_room), p_station_id => 'polka') $$, 'invalid_station',
  'only real stations');
select lives_ok($$ select public.set_room((select id from t_room), p_station_id => 'cafe') $$,
  'the owner picks the station');
select tests.act_as('00000000-0000-0000-0000-0000000000f2');
select is(public.room_info((select id from t_room)) ->> 'station_id', 'cafe', 'members see the new station');
select tests.act_as('00000000-0000-0000-0000-0000000000f1');
select is((public.set_room((select id from t_room), p_name => 'Radio crew 2')).station_id, 'cafe',
  'renaming leaves the station alone');

select * from finish();
rollback;
