begin;
select plan(12);

-- fixtures: Ada (owner) and Ben share a room; Cy is not in it
select tests.create_user('00000000-0000-0000-0000-0000000000b1', 'ada@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b2', 'ben@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000b3', 'cy@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000b1');
select public.complete_profile('ada', 'Ada', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select public.complete_profile('ben', 'Ben', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000b3');
select public.complete_profile('cyy', 'Cy', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000b1');
create temp table t_room as select * from public.create_room('Seats', 'Europe/London');
grant select on t_room to authenticated;
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select public.join_room((select invite_code from t_room));

-- Ada sits at chair 2 and studies
select tests.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.choose_seat((select id from t_room), 2) $$, 'members pick a chair');
select public.start_session((select id from t_room), 'stopwatch');
select is((select seat from public.room_live((select id from t_room)) where user_id = auth.uid()), 2,
  'room_live shows the chosen chair');

-- Ben can't take it while she's studying there, but can take another
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ select public.choose_seat((select id from t_room), 2) $$, 'seat_taken',
  'a chair someone is studying in is taken');
select lives_ok($$ select public.choose_seat((select id from t_room), 3) $$, 'another chair is fine');
select lives_ok($$ select public.choose_seat((select id from t_room), null) $$, 'and you can let the room pick again');
select throws_ok($$ select public.choose_seat((select id from t_room), 64) $$, 'invalid_seat', 'seats are 0–63');
select throws_ok($$ select public.choose_seat((select id from t_room), -1) $$, 'invalid_seat', 'no negative seats');

-- once Ada stops, her chair is free again
select tests.act_as('00000000-0000-0000-0000-0000000000b1');
select public.end_session((select id from public.sessions where user_id = auth.uid() and status = 'active'));
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$ select public.choose_seat((select id from t_room), 2) $$, 'a chair is free when nobody is studying in it');

-- outsiders and direct writes
select tests.act_as('00000000-0000-0000-0000-0000000000b3');
select throws_ok($$ select public.choose_seat((select id from t_room), 1) $$, 'not_a_member', 'only members pick chairs');
select tests.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ update public.room_members set seat = 5 where user_id = auth.uid() $$, '42501', null,
  'the seat can only be changed through choose_seat');

-- the new finishes for room looks
select tests.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.set_room_style((select id from t_room), 'charcoal', 'ebony') $$, 'the new finishes are allowed');
select throws_ok($$ select public.set_room_style((select id from t_room), 'charcoal', 'lava') $$, 'invalid_style',
  'unknown ones still are not');

select * from finish();
rollback;
