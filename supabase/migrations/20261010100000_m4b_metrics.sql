-- M4b: the /admin metrics (SPEC §12) and the remaining first-party events. Aggregates only, admins only.

-- Client-logged events: the spec's list of names that only the app itself can observe.
create or replace function public.log_event(p_name text, p_props jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_props jsonb := coalesce(p_props, '{}');
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    return;
  end if;
  if p_name not in ('app_open', 'onboarding_done', 'pwa_installed', 'push_enabled', 'reaction_sent', 'nudge_sent') then
    raise exception 'event_not_allowed' using errcode = '22023';
  end if;
  if jsonb_typeof(v_props) <> 'object' or exists (
    select 1 from jsonb_each(v_props) e
    where not (jsonb_typeof(e.value) in ('number', 'boolean')
               or (jsonb_typeof(e.value) = 'string' and e.value #>> '{}' ~ '^[a-z0-9_]{1,20}$'))
       or e.key !~ '^[a-z_]{1,20}$'
  ) then
    raise exception 'invalid_props' using errcode = '22023';
  end if;
  if (select count(*) from public.events where user_id = v_uid and at > now() - interval '1 minute') >= 30 then
    return; -- silently rate-limited
  end if;
  insert into public.events (user_id, name, props) values (v_uid, p_name, v_props);
end;
$$;

-- Weekly activity, daily actives, retention by signup week and the pomodoro mix. Admin accounts are
-- excluded everywhere, so the numbers describe other people's use (the application evidence).
create function public.admin_metrics(p_weeks int default 12) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_weeks int := least(greatest(coalesce(p_weeks, 12), 1), 52);
  v_from timestamptz;
begin
  if not coalesce((select is_admin from public.profiles where id = (select auth.uid())), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_from := date_trunc('week', now() at time zone 'UTC') at time zone 'UTC' - make_interval(weeks => v_weeks - 1);

  return (
    with people as (
      select id, created_at from public.profiles where not is_admin
    ), done as (
      select s.user_id, s.started_at, s.focus_seconds, s.kind,
             case when r.is_personal then 'solo' when r.sync_pomodoro then 'sync' else 'shared' end as place
        from public.sessions s
        join people p on p.id = s.user_id
        join public.rooms r on r.id = s.room_id
       where s.status = 'completed'
    ), weeks as (
      select generate_series(v_from, date_trunc('week', now() at time zone 'UTC') at time zone 'UTC', interval '1 week') as week
    ), weekly as (
      select w.week,
             count(distinct d.user_id)::int as wau,
             round(coalesce(sum(d.focus_seconds), 0) / 3600.0, 1) as hours,
             count(d.user_id)::int as sessions,
             count(*) filter (where d.kind = 'pomodoro' and d.place = 'sync')::int as sync_pomodoros,
             count(*) filter (where d.kind = 'pomodoro' and d.place = 'shared')::int as shared_pomodoros,
             count(*) filter (where d.kind = 'pomodoro' and d.place = 'solo')::int as solo_pomodoros,
             (select count(*)::int from people p where p.created_at >= w.week and p.created_at < w.week + interval '1 week') as signups
        from weeks w
        left join done d on d.started_at >= w.week and d.started_at < w.week + interval '1 week'
       group by w.week
    ), days as (
      select generate_series(date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' - interval '13 days',
                             date_trunc('day', now() at time zone 'UTC') at time zone 'UTC', interval '1 day') as day
    ), daily as (
      select dd.day, count(distinct d.user_id)::int as dau
        from days dd left join done d on d.started_at >= dd.day and d.started_at < dd.day + interval '1 day'
       group by dd.day
    ), cohorts as (
      select date_trunc('week', p.created_at at time zone 'UTC') at time zone 'UTC' as week, p.id, p.created_at
        from people p where p.created_at >= v_from
    ), retention as (
      -- Dn = studied (a completed session) on day n after signing up, counted only once day n is over.
      select c.week, count(*)::int as size,
             case when max(c.created_at) <= now() - interval '2 days' then
               count(*) filter (where exists (select 1 from done d where d.user_id = c.id
                 and d.started_at >= c.created_at + interval '1 day' and d.started_at < c.created_at + interval '2 days'))::int end as d1,
             case when max(c.created_at) <= now() - interval '8 days' then
               count(*) filter (where exists (select 1 from done d where d.user_id = c.id
                 and d.started_at >= c.created_at + interval '7 days' and d.started_at < c.created_at + interval '8 days'))::int end as d7,
             case when max(c.created_at) <= now() - interval '31 days' then
               count(*) filter (where exists (select 1 from done d where d.user_id = c.id
                 and d.started_at >= c.created_at + interval '30 days' and d.started_at < c.created_at + interval '31 days'))::int end as d30
        from cohorts c group by c.week
    )
    select jsonb_build_object(
      'generated_at', now(),
      'people', (select count(*) from people),
      'weekly', coalesce((select jsonb_agg(jsonb_build_object(
                  'week', to_char(w.week at time zone 'UTC', 'YYYY-MM-DD'), 'wau', w.wau, 'hours', w.hours,
                  'sessions', w.sessions,
                  'sessions_per_user', case when w.wau > 0 then round(w.sessions::numeric / w.wau, 1) else 0 end,
                  'sync_pomodoros', w.sync_pomodoros, 'shared_pomodoros', w.shared_pomodoros,
                  'solo_pomodoros', w.solo_pomodoros, 'signups', w.signups) order by w.week) from weekly w), '[]'),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(d.day at time zone 'UTC', 'YYYY-MM-DD'), 'dau', d.dau)
                  order by d.day) from daily d), '[]'),
      'retention', coalesce((select jsonb_agg(jsonb_build_object(
                  'week', to_char(r.week at time zone 'UTC', 'YYYY-MM-DD'), 'size', r.size,
                  'd1', r.d1, 'd7', r.d7, 'd30', r.d30) order by r.week) from retention r), '[]')
    )
  );
end;
$$;

revoke all on function public.admin_metrics(int) from public, anon;
grant execute on function public.admin_metrics(int) to authenticated;
revoke all on function public.log_event(text, jsonb) from public, anon;
grant execute on function public.log_event(text, jsonb) to authenticated;
