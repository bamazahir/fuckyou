-- Shared pgTAP helpers. Runs first (file order) without a transaction, so the helpers persist
-- for the later test files, which each run inside begin/rollback.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

create or replace function tests.create_user(p_id uuid, p_email text) returns uuid
language sql security definer set search_path = '' as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
          '{"provider":"email"}', '{}', now(), now())
  returning id
$$;

create or replace function tests.act_as(p_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.act_as_service() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

create or replace function tests.avatar() returns jsonb language sql immutable as $$
  select '{"colors":{"body":"#6FA06B","skin":"#E8B98F","hair":"#2B2622","top":"#7FB2D9"}}'::jsonb
$$;

-- A well-formed (65-byte, 0x04-prefixed) push key and a 16-byte auth secret, base64url.
create or replace function tests.push_key(p_fill text default 'ab') returns text language sql immutable as $$
  select rtrim(translate(replace(encode('\x04'::bytea || decode(repeat(p_fill, 64), 'hex'), 'base64'), E'\n', ''), '+/', '-_'), '=')
$$;
create or replace function tests.push_auth() returns text language sql immutable as $$
  select rtrim(translate(encode(decode(repeat('cd', 16), 'hex'), 'base64'), '+/', '-_'), '=')
$$;

grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

select plan(1);
select pass('test helpers installed');
select * from finish();
