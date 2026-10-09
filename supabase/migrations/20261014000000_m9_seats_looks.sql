-- M9: pick your seat, and more room looks (decision 0015).
--
-- Pick your seat: each member of a shared room can choose the chair they sit in.
-- The seat is an index into the room's seat list (src/core/seats.ts seatList), kept on the
-- membership so it survives between sessions. Personal rooms keep it on the device instead.

alter table public.room_members add column seat smallint
  constraint room_members_seat_range check (seat between 0 and 63);

-- Choose a seat (null = let the room pick). Refused while someone else studying here has it.
create function public.choose_seat(p_room_id uuid, p_seat int) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.active_uid();
begin
  if p_seat is not null and (p_seat < 0 or p_seat > 63) then
    raise exception 'invalid_seat' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_members
                  where room_id = p_room_id and user_id = v_uid and not banned) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if private.over_limit('seat', 30, 600) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  -- one chooser at a time per room, so two people can't take the same chair at once
  perform pg_advisory_xact_lock(hashtextextended('seat:' || p_room_id::text, 0));
  if p_seat is not null and exists (
    select 1 from public.room_members m
      join public.sessions s on s.user_id = m.user_id and s.room_id = m.room_id and s.status = 'active'
     where m.room_id = p_room_id and m.user_id <> v_uid and m.seat = p_seat and not m.banned
  ) then
    raise exception 'seat_taken' using errcode = '23505';
  end if;
  update public.room_members set seat = p_seat where room_id = p_room_id and user_id = v_uid;
  perform private.broadcast(p_room_id, 'state', jsonb_build_object('user_id', v_uid));
end;
$$;
revoke all on function public.choose_seat(uuid, int) from public, anon;
grant execute on function public.choose_seat(uuid, int) to authenticated;

-- room_live gains each person's chosen seat (a new column, so drop and recreate).
drop function public.room_live(uuid);
create function public.room_live(p_room_id uuid) returns table (
  user_id uuid, display_name text, avatar jsonb, state text, kind text, started_at timestamptz,
  planned_seconds int, status_line text, sitting_seconds int, break_until timestamptz, seat int
)
language plpgsql stable security definer set search_path = '' as $$
declare v_room public.rooms;
begin
  if not private.am_member(p_room_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  select * into v_room from public.rooms where id = p_room_id;
  return query
  with latest as (
    select distinct on (s.user_id) s.*, m.seat as member_seat
      from public.sessions s
      join public.room_members m on m.room_id = s.room_id and m.user_id = s.user_id and not m.banned
     where s.room_id = p_room_id and s.status in ('active', 'completed')
       and (s.status = 'active' or s.ended_at > now() - interval '20 minutes')
     order by s.user_id, s.started_at desc
  )
  select l.user_id, p.display_name, p.avatar,
         case when l.status = 'active' then 'focus' else 'break' end,
         l.kind, l.started_at, l.planned_seconds, l.status_line,
         (select coalesce(sum(private.session_seconds(x)), 0)::int
            from public.sessions x where x.sitting_id = l.sitting_id and x.status in ('active', 'completed')),
         case when l.status = 'completed' then
           l.ended_at + case when v_room.sync_pomodoro then make_interval(secs => v_room.sync_break_s)
                             else interval '15 minutes' end
         end,
         l.member_seat::int
    from latest l join public.profiles p on p.id = l.user_id
   where l.status = 'active'
      or (l.kind = 'pomodoro'
          and l.ended_at > now() - case when v_room.sync_pomodoro then make_interval(secs => v_room.sync_break_s)
                                        else interval '15 minutes' end
          and not exists (select 1 from public.sessions a where a.user_id = l.user_id and a.status = 'active'));
end;
$$;
revoke all on function public.room_live(uuid) from public, anon;
grant execute on function public.room_live(uuid) to authenticated;

-- More wall and floor finishes for the room "looks" (decision 0015). Same rules as M8's check; the
-- lists match src/content/roomStyles.ts (a unit test keeps them in step).
create or replace function private.valid_room_style(s jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(s) = 'object'
    and (select coalesce(bool_and(k in ('wall', 'floor')), true) from jsonb_object_keys(s) k)
    and (s -> 'wall' is null or coalesce(s ->> 'wall', '') in
          ('theme', 'cream', 'sage', 'sky', 'blush', 'lavender', 'mint', 'navy', 'terracotta', 'butter',
           'forest', 'charcoal'))
    and (s -> 'floor' is null or coalesce(s ->> 'floor', '') in
          ('theme', 'oak', 'birch', 'walnut', 'cherry', 'slate', 'chalk', 'ash', 'ebony')),
    false)
$$;
revoke all on function private.valid_room_style(jsonb) from public, anon, authenticated;
