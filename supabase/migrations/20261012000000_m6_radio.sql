-- M6: ambient radio (SPEC §11). Stations live in src/content/stations.json; the database only stores
-- which one a room plays, checked against this list (a unit test keeps the two in step).

create function private.valid_station(p_id text) returns boolean
language sql immutable set search_path = '' as $$
  select p_id in ('lofi', 'rain', 'cafe', 'brown', 'silence')
$$;

-- Lofi has no licensed tracks yet (decision 0013), so rooms start on Rain.
alter table public.rooms alter column station_id set default 'rain';
update public.rooms set station_id = 'rain' where station_id = 'lofi';

-- Owners and mods pick the room station; members hear about it on 'station' and refetch room_info.
create or replace function public.set_room(
  p_room_id uuid, p_name text default null, p_station_id text default null,
  p_sync_pomodoro boolean default null, p_sync_focus_s int default null, p_sync_break_s int default null
) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
  v_was boolean;
  v_station text;
begin
  perform private.require_role(p_room_id, 'owner', 'mod');
  if p_station_id is not null and not private.valid_station(p_station_id) then
    raise exception 'invalid_station' using errcode = '22023';
  end if;
  select sync_pomodoro, station_id into v_was, v_station from public.rooms where id = p_room_id;
  update public.rooms
     set name = coalesce(nullif(btrim(p_name), ''), name),
         station_id = coalesce(p_station_id, station_id),
         sync_pomodoro = coalesce(p_sync_pomodoro, sync_pomodoro),
         sync_focus_s = coalesce(p_sync_focus_s, sync_focus_s),
         sync_break_s = coalesce(p_sync_break_s, sync_break_s),
         sync_epoch = case when p_sync_focus_s is not null or p_sync_break_s is not null
                             or (p_sync_pomodoro and not v_was)
                           then now() else sync_epoch end
   where id = p_room_id
  returning * into r;
  if p_sync_pomodoro is not null or p_sync_focus_s is not null or p_sync_break_s is not null then
    perform private.broadcast(p_room_id, 'sync', jsonb_build_object('sync_pomodoro', r.sync_pomodoro));
  end if;
  if r.station_id is distinct from v_station then
    perform private.broadcast(p_room_id, 'station', jsonb_build_object('station_id', r.station_id));
  end if;
  return r;
end;
$$;

-- room_info gains the station.
create or replace function public.room_info(p_room_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.am_member(p_room_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'sync_pomodoro', r.sync_pomodoro, 'sync_focus_s', r.sync_focus_s, 'sync_break_s', r.sync_break_s,
      'sync_epoch', r.sync_epoch, 'notify_active', m.notify_active, 'layout', r.layout, 'bank_coins', r.bank_coins,
      'station_id', r.station_id)
      from public.rooms r join public.room_members m on m.room_id = r.id and m.user_id = (select auth.uid())
     where r.id = p_room_id
  );
end;
$$;

revoke all on function private.valid_station(text) from public, anon, authenticated;
