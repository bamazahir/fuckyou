-- M4b polish from the audit: valid room timezones, and "your rank this week" on Home (SPEC §5.2).

-- An unknown timezone would break that room's week boundary (leaderboards); fall back to UTC.
create or replace function public.create_room(p_name text, p_tz text, p_sync_pomodoro boolean default false) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_tz text := btrim(coalesce(p_tz, ''));
  r public.rooms;
begin
  if (select count(*) from public.rooms where owner_id = v_uid and not is_personal) >= 10 then
    raise exception 'too_many_rooms_created' using errcode = '54000';
  end if;
  if (select count(*) from public.room_members where user_id = v_uid and not banned) >= 20 then
    raise exception 'too_many_rooms' using errcode = '54000';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 40 then
    raise exception 'invalid_room_name' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;
  insert into public.rooms (name, owner_id, tz, sync_pomodoro)
  values (btrim(p_name), v_uid, v_tz, coalesce(p_sync_pomodoro, false))
  returning * into r;
  insert into public.room_members (room_id, user_id, role) values (r.id, v_uid, 'owner');
  insert into public.events (user_id, name) values (v_uid, 'room_created');
  return r;
end;
$$;

drop function public.my_rooms();
create function public.my_rooms() returns table (
  id uuid, name text, role text, invite_code text, member_count int, studying_count int, sync_pomodoro boolean,
  studying jsonb, week_rank int
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name, m.role, r.invite_code,
         (select count(*)::int from public.room_members x where x.room_id = r.id and not x.banned),
         (select count(*)::int from public.sessions s where s.room_id = r.id and s.status = 'active'),
         r.sync_pomodoro,
         coalesce((select jsonb_agg(jsonb_build_object('display_name', a.display_name, 'avatar', a.avatar))
                     from (select p.display_name, p.avatar from public.sessions s join public.profiles p on p.id = s.user_id
                            where s.room_id = r.id and s.status = 'active' order by s.started_at limit 4) a), '[]'::jsonb),
         -- Your place on this room's week board, once you have minutes there.
         (select l.rank from public.leaderboard(r.id, 'week') l where l.user_id = (select auth.uid()) and l.seconds > 0)
    from public.room_members m join public.rooms r on r.id = m.room_id
   where m.user_id = (select auth.uid()) and not m.banned and not r.is_personal
   order by (select count(*) from public.sessions s where s.room_id = r.id and s.status = 'active') desc, r.name
$$;

revoke all on function public.my_rooms() from public, anon;
grant execute on function public.my_rooms() to authenticated;
revoke all on function public.create_room(text, text, boolean) from public, anon;
grant execute on function public.create_room(text, text, boolean) to authenticated;
