-- health(): the cheapest possible call, used by .github/workflows/keepalive.yml (SPEC §18)
-- so the free-tier project registers activity. Returns only the server time.
create or replace function public.health()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.health() from public;
grant execute on function public.health() to anon, authenticated;
