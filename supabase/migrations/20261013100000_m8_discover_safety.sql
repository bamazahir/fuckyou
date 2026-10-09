-- Discover safety fixes from the M8 review (docs/decisions/0014, OPEN-ITEMS).

-- Everyone in a listed room is in one age band, with no blocks between them and you.
create function private.fits_listed_room(p_room_id uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
           select 1 from public.room_members m join public.profiles p on p.id = m.user_id
            where m.room_id = p_room_id and not m.banned and m.user_id <> p_uid
              and private.age_band(p.age_bracket) <> (select private.age_band(age_bracket) from public.profiles where id = p_uid))
     and not exists (
           select 1 from public.room_members m join public.blocks b
               on (b.blocker_id = m.user_id and b.blocked_id = p_uid) or (b.blocker_id = p_uid and b.blocked_id = m.user_id)
            where m.room_id = p_room_id)
$$;
revoke all on function private.fits_listed_room(uuid, uuid) from public, anon, authenticated;

-- 1. An invite code from a listed room only works for people who could find it in Discover, so a
--    code passed on can't bring an adult into a room of 13–15 year olds.
-- 2. The member count is checked under a row lock, so the 50 cap holds under simultaneous joins.
create or replace function public.join_room(p_code text) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  r public.rooms;
  m public.room_members;
begin
  if private.over_limit('join', 10, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  select * into r from public.rooms where invite_code = upper(btrim(p_code)) and not is_personal for update;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  select * into m from public.room_members where room_id = r.id and user_id = v_uid;
  if found then
    if m.banned then
      raise exception 'banned_from_room' using errcode = '42501';
    end if;
    return r; -- already a member
  end if;
  if r.listed and not private.fits_listed_room(r.id, v_uid) then
    raise exception 'listed_age_group' using errcode = '42501';
  end if;
  if (select count(*) from public.room_members where room_id = r.id and not banned) >= 50 then
    raise exception 'room_full' using errcode = '54000';
  end if;
  if (select count(*) from public.room_members where user_id = v_uid and not banned) >= 20 then
    raise exception 'too_many_rooms' using errcode = '54000';
  end if;
  insert into public.room_members (room_id, user_id) values (r.id, v_uid);
  insert into public.events (user_id, name) values (v_uid, 'room_joined');
  perform private.broadcast(r.id, 'joined', jsonb_build_object('user_id', v_uid));
  return r;
end;
$$;

-- 3. Joining from Discover returns only the id and name (not the invite code or anything else).
drop function public.join_listed_room(uuid);
create function public.join_listed_room(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  r public.rooms;
begin
  if not private.discoverable(p_room_id, v_uid) then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  r := public.join_room((select invite_code from public.rooms where id = p_room_id));
  return jsonb_build_object('id', r.id, 'name', r.name);
end;
$$;
revoke all on function public.join_listed_room(uuid) from public, anon;
grant execute on function public.join_listed_room(uuid) to authenticated;

-- 4. A listed room's invite preview shows no names or faces (faceless until you join).
create or replace function public.preview_room(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.rooms;
begin
  if private.over_limit('preview', 30, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  select * into r from public.rooms where invite_code = upper(btrim(p_code)) and not is_personal;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'member_count', (select count(*) from public.room_members m where m.room_id = r.id and not m.banned),
    'studying', case when r.listed then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('display_name', p.display_name, 'avatar', p.avatar) order by s.started_at)
        from public.sessions s join public.profiles p on p.id = s.user_id
       where s.room_id = r.id and s.status = 'active'), '[]'::jsonb) end
  );
end;
$$;

-- 5. Discover is rate-limited, needs at least 3 members to list, and hides live counts of small
--    rooms (polling them would show when two friends are online).
drop function public.discover_rooms();
create function public.discover_rooms() returns table (
  id uuid, name text, member_count int, studying_count int, sync_pomodoro boolean
)
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := private.active_uid();
begin
  if private.over_limit('discover', 30, 600) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  return query
    select x.id, x.name, x.members,
           case when x.members >= 5 then x.studying end,
           x.sync_pomodoro
      from (
        select r.id, r.name, r.sync_pomodoro, r.created_at,
               (select count(*)::int from public.room_members m where m.room_id = r.id and not m.banned) as members,
               (select count(*)::int from public.sessions s where s.room_id = r.id and s.status = 'active') as studying
          from public.rooms r
         where r.listed and private.discoverable(r.id, v_uid)
      ) x
     where x.members >= 3
     order by x.members desc, x.created_at desc
     limit 30;
end;
$$;
revoke all on function public.discover_rooms() from public, anon;
grant execute on function public.discover_rooms() to authenticated;

create or replace function public.set_room_listed(p_room_id uuid, p_listed boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_role(p_room_id, 'owner');
begin
  if p_listed and exists (
       select 1 from public.room_members m join public.profiles p on p.id = m.user_id
        where m.room_id = p_room_id and not m.banned
          and private.age_band(p.age_bracket) <> (select private.age_band(age_bracket) from public.profiles where id = v_uid)) then
    raise exception 'mixed_ages' using errcode = '22023';
  end if;
  if p_listed and (select count(*) from public.room_members where room_id = p_room_id and not banned) < 3 then
    raise exception 'too_few_to_list' using errcode = '22023';
  end if;
  update public.rooms set listed = coalesce(p_listed, false) where id = p_room_id and not is_personal;
end;
$$;
