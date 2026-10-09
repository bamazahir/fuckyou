begin;
select plan(8);

select tests.create_user('00000000-0000-0000-0000-0000000000f1', 'adm@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000f2', 'uma@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000f3', 'vik@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000f1');
select public.complete_profile('adm', 'Adm', 'GB', '18+', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000f2');
select public.complete_profile('uma', 'Uma', 'GB', '16-17', tests.avatar(), 'Europe/London');
select tests.act_as('00000000-0000-0000-0000-0000000000f3');
select public.complete_profile('vik', 'Vik', 'GB', '16-17', tests.avatar(), 'Europe/London');

select tests.act_as_service();
-- Halfway between UTC midnight and now: always today and this week, whenever the test runs.
create function tests.earlier_today() returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
         + (now() - (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')) / 2
$$;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000f1';
-- Uma signed up 10 days ago and studied on day 1 and day 7; Vik signed up today. The admin studies too.
update public.profiles set created_at = now() - interval '10 days' where id = '00000000-0000-0000-0000-0000000000f2';
insert into public.sessions (user_id, room_id, sitting_id, kind, status, planned_seconds, started_at, ended_at, focus_seconds)
select p.id, r.id, gen_random_uuid(), 'pomodoro', 'completed', 1500, t, t + interval '25 minutes', 1500
  from (values ('00000000-0000-0000-0000-0000000000f2'::uuid, now() - interval '10 days' + interval '1 day 2 hours'),
               ('00000000-0000-0000-0000-0000000000f2'::uuid, now() - interval '10 days' + interval '7 days 3 hours'),
               ('00000000-0000-0000-0000-0000000000f2'::uuid, tests.earlier_today()),
               ('00000000-0000-0000-0000-0000000000f3'::uuid, tests.earlier_today()),
               ('00000000-0000-0000-0000-0000000000f1'::uuid, tests.earlier_today())) as x(uid, t)
  join public.profiles p on p.id = x.uid
  join public.rooms r on r.owner_id = p.id and r.is_personal;

select tests.act_as('00000000-0000-0000-0000-0000000000f2');
select throws_ok($$ select public.admin_metrics() $$, 'not_allowed', 'only admins see the metrics');

select tests.act_as('00000000-0000-0000-0000-0000000000f1');
create temp table m as select public.admin_metrics(4) as j;
select is(jsonb_array_length((select j -> 'weekly' from m)), 4, 'one row per week asked for');
select is(((select j -> 'weekly' from m) -> -1 ->> 'wau')::int, 2, 'this week''s active users exclude the admin');
select is(((select j -> 'weekly' from m) -> -1 ->> 'solo_pomodoros')::int, ((select j -> 'weekly' from m) -> -1 ->> 'sessions')::int,
  'pomodoros are split by where they happened (all solo here)');
select is(((select j -> 'daily' from m) -> -1 ->> 'dau')::int, 2, 'today''s daily actives');
select is((select j ->> 'people' from m)::int, 2, 'people counted exclude admins');
select is((select (r ->> 'd1')::int from m, jsonb_array_elements(j -> 'retention') r where (r ->> 'size')::int = 1
            and r ->> 'd7' is not null), 1, 'D1 counts a session on the day after signing up');
select ok((select bool_and(r ->> 'd30' is null) from m, jsonb_array_elements(j -> 'retention') r),
  'D30 stays empty until 30 days have passed');

select * from finish();
rollback;
