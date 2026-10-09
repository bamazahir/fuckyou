-- M7 ship-audit fixes for the coin, layout and radio work (docs/audits/2026-10-09-M7.md).

-- H1: the 720/day cap is counted in the profile timezone, so switching zones could open a fresh "day".
-- The timezone is set once at signup (complete_profile); clients can no longer change it directly.
revoke update (tz) on table public.profiles from authenticated;

-- H2: store a normalised layout (only item_id/x/z/rot), never the caller's JSON: no hidden free text
-- between members, and a hard size cap. Saves are rate-limited (each shared save notifies the room).
-- L2: huge coordinates are refused as invalid_layout before any integer cast.
create or replace function public.save_layout(p_room_id uuid, p_layout jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_room public.rooms;
  v_err jsonb;
  v_short text;
  v_clean jsonb;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  if v_room.is_personal then
    if v_room.owner_id <> v_uid then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  else
    perform private.require_role(p_room_id, 'owner', 'mod');
  end if;
  if private.over_limit('layout', 20, 600) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if jsonb_typeof(p_layout) <> 'array' or exists (
       select 1 from jsonb_array_elements(p_layout) x
        where jsonb_typeof(x) <> 'object'
           or exists (select 1 from jsonb_object_keys(x) k where k not in ('item_id', 'x', 'z', 'rot'))
           or (jsonb_typeof(x -> 'x') = 'number' and abs((x ->> 'x')::numeric) > 1000)
           or (jsonb_typeof(x -> 'z') = 'number' and abs((x ->> 'z')::numeric) > 1000)
           or (jsonb_typeof(x -> 'rot') = 'number' and abs((x ->> 'rot')::numeric) > 1000)) then
    raise exception 'invalid_layout' using errcode = '22023', detail = '{"error":"bad_layout"}';
  end if;
  v_err := private.layout_error(p_layout, case when v_room.is_personal then 8 else 12 end);
  if v_err is not null then
    raise exception 'invalid_layout' using errcode = '22023', detail = v_err::text;
  end if;
  -- You can only place what you (or the room) own.
  select u.item_id into v_short
    from (select x ->> 'item_id' as item_id, count(*) as n from jsonb_array_elements(p_layout) x group by 1) u
   where u.n > coalesce(case when v_room.is_personal
                         then (select qty from public.inventory where user_id = v_uid and item_id = u.item_id)
                         else (select qty from public.room_inventory where room_id = p_room_id and item_id = u.item_id) end, 0)
   limit 1;
  if v_short is not null then
    raise exception 'item_not_owned' using errcode = '22023', detail = v_short;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', x ->> 'item_id', 'x', (x ->> 'x')::numeric::int, 'z', (x ->> 'z')::numeric::int,
           'rot', (x ->> 'rot')::numeric::int)
           order by ord), '[]')
    into v_clean
    from jsonb_array_elements(p_layout) with ordinality as t(x, ord);
  update public.rooms set layout = v_clean where id = p_room_id;
  if not v_room.is_personal then
    perform private.broadcast(p_room_id, 'layout', '{}'::jsonb);
  end if;
end;
$$;

-- Defence in depth: whatever writes a layout, it stays small (80 items ≈ 4 KB).
alter table public.rooms add constraint rooms_layout_size check (pg_column_size(layout) < 16384);

-- M1: an admin overturning an unfair void gives back what the void took (wallet and room bank).
-- L6: the room's timezone falls back to UTC like every other path.
create or replace function private.sessions_coin_effects() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_room public.rooms;
  v_tz text;
  v_today int;
  v_add int;
  v_back int;
begin
  if new.status = 'completed' and old.status = 'active' then
    select * into v_room from public.rooms where id = new.room_id;
    if not v_room.is_personal then
      v_tz := case when exists (select 1 from pg_catalog.pg_timezone_names where name = v_room.tz)
                   then v_room.tz else 'UTC' end;
      select coalesce(sum(delta), 0)::int into v_today from public.room_bank_ledger
       where room_id = new.room_id and user_id = new.user_id and reason = 'study'
         and created_at >= (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
      v_add := least(coalesce(new.focus_seconds, 0) / 120, greatest(360 - v_today, 0));
      if v_add > 0 then
        insert into public.room_bank_ledger (room_id, user_id, delta, reason, ref)
        values (new.room_id, new.user_id, v_add, 'study', new.id);
      end if;
    end if;
  elsif new.status = 'voided' and old.status <> 'voided' then
    select coalesce(sum(delta), 0)::int into v_back from public.coin_ledger
     where ref = new.id and reason in ('session', 'bonus', 'void', 'admin');
    if v_back > 0 then
      insert into public.coin_ledger (user_id, delta, reason, ref) values (new.user_id, -v_back, 'void', new.id);
    end if;
    select coalesce(sum(delta), 0)::int into v_back from public.room_bank_ledger
     where ref = new.id and reason in ('study', 'void');
    if v_back > 0 then
      insert into public.room_bank_ledger (room_id, user_id, delta, reason, ref)
      values (new.room_id, new.user_id, -v_back, 'void', new.id);
    end if;
  elsif new.status = 'completed' and old.status = 'voided' then
    -- Un-voided: credit back exactly what the voids took, net of earlier restores.
    select -coalesce(sum(delta), 0)::int into v_back from public.coin_ledger
     where ref = new.id and reason in ('void', 'admin');
    if v_back > 0 then
      insert into public.coin_ledger (user_id, delta, reason, ref) values (new.user_id, v_back, 'admin', new.id);
    end if;
    select -coalesce(sum(delta), 0)::int into v_back from public.room_bank_ledger
     where ref = new.id and reason = 'void';
    if v_back > 0 then
      insert into public.room_bank_ledger (room_id, user_id, delta, reason, ref)
      values (new.room_id, new.user_id, v_back, 'void', new.id);
    end if;
  end if;
  return new;
end;
$$;

-- L3: the "already own this accessory" check runs under the same lock as the payment.
create or replace function public.buy_item(p_item_id text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.active_uid();
  v_item public.catalog_items;
  v_qty int := coalesce(p_qty, 1);
  v_cost int;
begin
  select * into v_item from public.catalog_items where id = p_item_id;
  if not found then
    raise exception 'unknown_item' using errcode = 'P0002';
  end if;
  if v_qty not between 1 and 10 or (v_item.category = 'accessory' and v_qty <> 1) then
    raise exception 'invalid_qty' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('coins:' || v_uid::text, 0));
  if v_item.category = 'accessory'
     and exists (select 1 from public.inventory where user_id = v_uid and item_id = p_item_id and qty > 0) then
    raise exception 'already_owned' using errcode = '22023';
  end if;
  v_cost := v_item.price * v_qty;
  if private.balance(v_uid) < v_cost then
    raise exception 'not_enough_coins' using errcode = '22023';
  end if;
  insert into public.coin_ledger (user_id, delta, reason) values (v_uid, -v_cost, 'purchase');
  insert into public.inventory (user_id, item_id, qty) values (v_uid, p_item_id, v_qty)
  on conflict (user_id, item_id) do update set qty = public.inventory.qty + excluded.qty;
  insert into public.events (user_id, name, props)
  values (v_uid, 'item_bought', jsonb_build_object('category', v_item.category, 'price', v_item.price));
  return jsonb_build_object('balance', private.balance(v_uid));
end;
$$;

-- L4: the export includes what you gave to room banks (by room), and what each coin row was for.
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at) from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) - 'is_admin' from public.profiles p where p.id = v_uid),
    'rooms', coalesce((select jsonb_agg(jsonb_build_object('room', r.name, 'role', m.role, 'joined_at', m.joined_at,
                                                           'notify_active', m.notify_active))
                         from public.room_members m join public.rooms r on r.id = m.room_id where m.user_id = v_uid), '[]'),
    'personal_room_layout', (select layout from public.rooms where owner_id = v_uid and is_personal),
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id' order by s.started_at)
                            from public.sessions s where s.user_id = v_uid), '[]'),
    'coins', coalesce((select jsonb_agg(jsonb_build_object('delta', c.delta, 'reason', c.reason, 'session', c.ref,
                                                           'at', c.created_at) order by c.id)
                         from public.coin_ledger c where c.user_id = v_uid), '[]'),
    'room_banks', coalesce((select jsonb_agg(jsonb_build_object('room', r.name, 'delta', b.delta, 'reason', b.reason,
                                                                'at', b.created_at) order by b.id)
                              from public.room_bank_ledger b join public.rooms r on r.id = b.room_id
                             where b.user_id = v_uid), '[]'),
    'inventory', coalesce((select jsonb_object_agg(i.item_id, i.qty) from public.inventory i where i.user_id = v_uid), '{}'),
    'blocks', coalesce((select jsonb_agg(b.blocked_id) from public.blocks b where b.blocker_id = v_uid), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('type', r.target_type, 'reason', r.reason, 'at', r.created_at))
                                 from public.reports r where r.reporter_id = v_uid), '[]'),
    'push_devices', coalesce((select jsonb_agg(jsonb_build_object('service', split_part(ps.endpoint, '/', 3), 'added_at', ps.created_at))
                                from public.push_subscriptions ps where ps.user_id = v_uid), '[]'),
    'parental_consent', (select jsonb_build_object('granted_at', c.granted_at, 'expires_at', c.expires_at)
                           from public.parental_consents c where c.user_id = v_uid)
  );
end;
$$;
