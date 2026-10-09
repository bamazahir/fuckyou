begin;
select plan(30);

-- ---------- fixtures: owner Rae, member Sol, outsider Tia ----------
select tests.create_user('00000000-0000-0000-0000-0000000000c5', 'rae@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000c6', 'sol@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000c7', 'tia@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000c5');
select public.complete_profile('rae', 'Rae', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000c6');
select public.complete_profile('sol', 'Sol', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000c7');
select public.complete_profile('tia', 'Tia', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000c5');
create temp table t_room as select * from public.create_room('Coin crew', 'Europe/London');
grant select on t_room to authenticated;
select tests.act_as('00000000-0000-0000-0000-0000000000c6');
select public.join_room((select invite_code from t_room));

-- ---------- starter things ----------
select is((select qty from public.inventory where item_id = 'desk_oak'), 1, 'everyone starts with the starter room''s things');
select is((select qty from public.room_inventory where room_id = (select id from t_room) and item_id = 'chair_wood'), 4,
  'a new shared room starts with 4 chairs');
select throws_ok($$ insert into public.coin_ledger (user_id, delta, reason) values (auth.uid(), 9999, 'admin') $$,
  '42501', null, 'nobody can write coins directly');
select throws_ok($$ update public.inventory set qty = 99 where item_id = 'desk_oak' $$, '42501', null,
  'nobody can write their inventory directly');

-- ---------- earning ----------
-- Sol finishes a full 25-minute pomodoro in the shared room.
select tests.act_as_service();
insert into public.sessions (user_id, room_id, sitting_id, kind, status, planned_seconds, started_at)
values ('00000000-0000-0000-0000-0000000000c6', (select id from t_room), gen_random_uuid(), 'pomodoro', 'active', 1500,
        now() - interval '25 minutes');
update public.sessions set status = 'completed', ended_at = now(), focus_seconds = 1500
 where user_id = '00000000-0000-0000-0000-0000000000c6' and status = 'active';
select is((select bank_coins from public.rooms where id = (select id from t_room)), 12,
  'the room bank gets half a coin per focus minute');
select tests.act_as('00000000-0000-0000-0000-0000000000c6');
create temp table t_s as select id from public.sessions where user_id = auth.uid() order by started_at desc limit 1;
grant select on t_s to authenticated;
select is(public.submit_note((select id from t_s), 'finished Q3', false), 30, 'a note pays 25 coins + 5 for a full pomodoro');
select is((public.my_wallet() ->> 'balance')::int, 30, 'the wallet shows the balance');
select throws_ok($$ select public.submit_note((select id from t_s), 'again', false) $$, 'note_not_possible',
  'a session pays only once');

-- the daily cap: 720 a day
select tests.act_as_service();
insert into public.coin_ledger (user_id, delta, reason) values ('00000000-0000-0000-0000-0000000000c6', 680, 'session');
insert into public.sessions (user_id, room_id, sitting_id, kind, status, planned_seconds, started_at, ended_at, focus_seconds)
values ('00000000-0000-0000-0000-0000000000c6', (select id from t_room), gen_random_uuid(), 'pomodoro', 'completed', 1500,
        now() - interval '30 minutes', now() - interval '5 minutes', 1500);
select tests.act_as('00000000-0000-0000-0000-0000000000c6');
select is(public.submit_note((select id from public.sessions where user_id = auth.uid() and note is null and status = 'completed'
                                order by started_at desc limit 1), 'more work', false), 10,
  'earnings stop at the daily cap of 720');

-- ---------- voiding reverses ----------
select tests.act_as('00000000-0000-0000-0000-0000000000c5');
select public.void_session((select id from t_s), 'was not studying');
select tests.act_as('00000000-0000-0000-0000-0000000000c6');
select is((public.my_wallet() ->> 'balance')::int, 30 + 680 + 10 - 30, 'voiding takes back what the session paid');
select is((select bank_coins from public.rooms where id = (select id from t_room)), 0,
  'and the room bank gives back its share');

-- ---------- spending ----------
select throws_ok($$ select public.buy_item('telescope') $$, 'not_enough_coins', 'you can''t spend more than you have');
select throws_ok($$ select public.buy_item('throne') $$, 'unknown_item', 'only catalog items');
select is((public.buy_item('cactus', 2) ->> 'balance')::int, 690 - 70, 'buying takes the price');
select is((select qty from public.inventory where user_id = auth.uid() and item_id = 'cactus'), 2, 'and adds to the inventory');
select lives_ok($$ select public.buy_item('beret') $$, 'accessories can be bought');
select throws_ok($$ select public.buy_item('beret') $$, 'already_owned', 'an accessory is bought once');
select lives_ok($$ select public.save_layout((select id from public.rooms where owner_id = auth.uid() and is_personal),
  '[{"item_id":"cactus","x":0,"z":0,"rot":0},{"item_id":"cactus","x":1,"z":0,"rot":0},{"item_id":"desk_oak","x":3,"z":3,"rot":2}]') $$,
  'you can place what you own');
select throws_ok($$ select public.save_layout((select id from public.rooms where owner_id = auth.uid() and is_personal),
  '[{"item_id":"desk_oak","x":0,"z":0,"rot":0},{"item_id":"desk_oak","x":2,"z":0,"rot":0}]') $$,
  'item_not_owned', 'but not more than you own');
select throws_ok($$ select public.save_layout((select id from public.rooms where owner_id = auth.uid() and is_personal),
  '[{"item_id":"desk_oak","x":0,"z":0,"rot":0},{"item_id":"cactus","x":0,"z":0,"rot":0}]') $$,
  'invalid_layout', 'and not on top of each other');
select throws_ok($$ select public.save_layout((select id from t_room), '[]') $$, 'not_allowed',
  'members can''t redecorate a shared room');

-- donating and room purchases
select is((public.donate((select id from t_room), 100) ->> 'bank')::int, 100, 'donations go to the room bank');
select throws_ok($$ select public.room_buy_item((select id from t_room), 'plant_pot') $$, 'not_allowed',
  'only owners and mods spend the bank');
select tests.act_as('00000000-0000-0000-0000-0000000000c5');
select is((public.room_buy_item((select id from t_room), 'plant_pot', 2) ->> 'bank')::int, 20, 'the owner buys for the room');
select throws_ok($$ select public.room_buy_item((select id from t_room), 'telescope') $$, 'not_enough_coins',
  'the bank can''t go negative');

-- ---------- accessories must be owned to wear ----------
select throws_ok($$ update public.profiles set avatar = tests.avatar() || '{"accessories":["cat_ears"]}' where id = auth.uid() $$,
  'accessory_not_owned', 'shop accessories must be owned to wear');
select lives_ok($$ update public.profiles set avatar = tests.avatar() || '{"accessories":["beanie"]}' where id = auth.uid() $$,
  'starter accessories are free');

-- ---------- visiting ----------
select ok((public.visit_room('00000000-0000-0000-0000-0000000000c6') ->> 'display_name') = 'Sol', 'roommates can visit each other''s rooms');
select tests.act_as('00000000-0000-0000-0000-0000000000c7');
select throws_ok($$ select public.visit_room('00000000-0000-0000-0000-0000000000c6') $$, 'not_allowed',
  'strangers can''t');
select tests.act_as('00000000-0000-0000-0000-0000000000c6');
select public.block_user('00000000-0000-0000-0000-0000000000c5');
select tests.act_as('00000000-0000-0000-0000-0000000000c5');
select throws_ok($$ select public.visit_room('00000000-0000-0000-0000-0000000000c6') $$, 'not_allowed',
  'and nobody you blocked, or who blocked you');

select * from finish();
rollback;
