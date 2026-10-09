-- M4a: outfits, starter accessories and an accessory color (decision 0008). Same jsonb column.
create or replace function private.valid_avatar(a jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(a) = 'object'
     and jsonb_typeof(a -> 'colors') = 'object'
     and (select bool_and(coalesce(a -> 'colors' ->> k, '') ~ '^#[0-9a-fA-F]{6}$')
            from unnest(array['body', 'skin', 'hair', 'top']) as k)
     and (a -> 'colors' -> 'accent' is null or a -> 'colors' ->> 'accent' ~ '^#[0-9a-fA-F]{6}$')
     and (a -> 'hair' is null or a ->> 'hair' in ('short', 'long', 'curly', 'bun'))
     and (a -> 'outfit' is null or (
           jsonb_typeof(a -> 'outfit') = 'object'
           and (a -> 'outfit' -> 'top' is null or a -> 'outfit' ->> 'top' in ('tee', 'hoodie', 'stripes', 'collar'))
           and (a -> 'outfit' -> 'bottom' is null or a -> 'outfit' ->> 'bottom' in ('trousers', 'shorts', 'skirt'))))
     and (a -> 'accessories' is null or (
           jsonb_typeof(a -> 'accessories') = 'array'
           and jsonb_array_length(a -> 'accessories') <= 4
           and (select bool_and(x in ('beanie', 'cap', 'bow', 'glasses', 'headphones', 'scarf'))
                  from jsonb_array_elements_text(a -> 'accessories') as x) is not false
           -- one hat at most
           and (select count(*) from jsonb_array_elements_text(a -> 'accessories') as x
                 where x in ('beanie', 'cap', 'bow')) <= 1
           and (select count(*) from jsonb_array_elements_text(a -> 'accessories') as x)
             = (select count(distinct x) from jsonb_array_elements_text(a -> 'accessories') as x)))
     and pg_column_size(a) < 2048
$$;
