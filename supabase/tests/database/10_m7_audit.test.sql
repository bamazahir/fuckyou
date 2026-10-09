begin;
select plan(11);

-- fixtures: owner Ivy, member Max
select tests.create_user('00000000-0000-0000-0000-0000000000d1', 'ivy@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000d2', 'max@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000d1');
select public.complete_profile('ivy', 'Ivy', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000d2');
select public.complete_profile('max', 'Max', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000d1');
create temp table t_room as select * from public.create_room('Audit crew', 'Europe/London');
grant select on t_room to authenticated;
select tests.act_as('00000000-0000-0000-0000-0000000000d2');
select public.join_room((select invite_code from t_room));

-- H1: no timezone hopping to reset the daily cap
select throws_ok($$ update public.profiles set tz = 'Pacific/Kiritimati' where id = auth.uid() $$, '42501', null,
  'your timezone can''t be changed directly (it would reset the 720/day cap)');

-- H2 / L2: layouts hold only item_id/x/z/rot, small numbers, and are stored normalised
select tests.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$ select public.save_layout((select id from public.rooms where owner_id = auth.uid() and is_personal),
                     '[{"item_id":"desk_oak","x":2,"z":3,"rot":2,"msg":"text me"}]') $$,
  'invalid_layout', 'extra keys (hidden messages) are refused');
select throws_ok($$ select public.save_layout((select id from public.rooms where owner_id = auth.uid() and is_personal),
                     '[{"item_id":"window_double","x":1e30,"z":0,"rot":0}]') $$,
  'invalid_layout', 'absurd coordinates are an invalid layout, not a crash');
select lives_ok($$ select public.save_layout((select id from public.rooms where owner_id = auth.uid() and is_personal),
                    '[{"rot":2,"z":3.0,"item_id":"desk_oak","x":2}]') $$, 'a valid layout saves');
select is((select layout from public.rooms where owner_id = auth.uid() and is_personal),
  '[{"item_id":"desk_oak","x":2,"z":3,"rot":2}]'::jsonb, 'it is stored normalised');
select tests.act_as_service();
select throws_ok($$ update public.rooms set layout = (select jsonb_agg(jsonb_build_object('pad', repeat('x', 1000)))
                                                        from generate_series(1, 40))
                     where id = (select id from t_room) $$,
  '23514', null, 'layouts can''t grow past 16 KB, whatever writes them');

-- M5 bank cap: at most 360 coins per member, room and day
do $$
begin
  for g in 1 .. 4 loop
    insert into public.sessions (user_id, room_id, sitting_id, kind, status, started_at)
    values ('00000000-0000-0000-0000-0000000000d2', (select id from t_room), gen_random_uuid(), 'stopwatch', 'active',
            now() - make_interval(hours => 5 * g));
    update public.sessions set status = 'completed', ended_at = started_at + interval '4 hours', focus_seconds = 14400
     where user_id = '00000000-0000-0000-0000-0000000000d2' and status = 'active';
  end loop;
end $$;
select is((select bank_coins from public.rooms where id = (select id from t_room)), 360,
  'study fills the room bank up to 360 per member per day');

-- M1: overturning a void gives back the coins and the bank contribution
create temp table t_s as
  select id from public.sessions where user_id = '00000000-0000-0000-0000-0000000000d2' order by started_at desc limit 1;
grant select on t_s to authenticated;
update public.sessions set ended_at = now() - interval '1 minute' where id = (select id from t_s);
select tests.act_as('00000000-0000-0000-0000-0000000000d2');
select public.submit_note((select id from t_s), 'long day', false);
select tests.act_as_service();
create temp table t_before as select private.balance('00000000-0000-0000-0000-0000000000d2') as coins,
  (select bank_coins from public.rooms where id = (select id from t_room)) as bank;
update public.sessions set status = 'voided' where id = (select id from t_s);
select ok(private.balance('00000000-0000-0000-0000-0000000000d2') < (select coins from t_before), 'a void takes the coins back');
update public.sessions set status = 'completed' where id = (select id from t_s);
select is(private.balance('00000000-0000-0000-0000-0000000000d2'), (select coins from t_before),
  'overturning the void gives the coins back');
select is((select bank_coins from public.rooms where id = (select id from t_room)), (select bank from t_before),
  'and the room bank contribution');

-- layout saves are rate-limited (each shared save notifies the whole room)
select tests.act_as('00000000-0000-0000-0000-0000000000d1');
select public.save_layout((select id from public.rooms where owner_id = auth.uid() and is_personal), '[]')
  from generate_series(1, 19); -- plus the valid save above = 20 in this window
select throws_ok($$ select public.save_layout((select id from public.rooms where owner_id = auth.uid() and is_personal), '[]') $$,
  'rate_limited', 'saving a layout over and over is limited');

select * from finish();
rollback;
