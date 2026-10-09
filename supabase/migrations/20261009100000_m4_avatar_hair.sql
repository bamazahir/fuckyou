-- M4a: avatars gain an optional hairstyle (decision 0007). Same jsonb column, one more check.
create or replace function private.valid_avatar(a jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(a) = 'object'
     and jsonb_typeof(a -> 'colors') = 'object'
     and (select bool_and(coalesce(a -> 'colors' ->> k, '') ~ '^#[0-9a-fA-F]{6}$')
            from unnest(array['body', 'skin', 'hair', 'top']) as k)
     and (a -> 'hair' is null or a ->> 'hair' in ('short', 'long', 'curly', 'bun'))
     and (a -> 'accessories' is null or jsonb_typeof(a -> 'accessories') = 'array')
     and pg_column_size(a) < 2048
$$;
