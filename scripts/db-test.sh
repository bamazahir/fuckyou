#!/usr/bin/env bash
# Runs the pgTAP suite. Uses `supabase test db` when its runner works; this fallback talks to the
# local database directly with psql (useful where the pg_prove image can't be pulled).
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
fail=0
for f in supabase/tests/database/*.sql; do
  out=$(psql -X -q -t -A -v ON_ERROR_STOP=1 "$DB_URL" -f "$f" 2>&1) || { echo "$out"; echo "ERROR in $f"; fail=1; continue; }
  if echo "$out" | grep -qE '^\s*not ok|# Looks like you'; then echo "$out" | grep -E 'not ok|#' ; echo "FAIL $f"; fail=1
  else echo "ok   $f ($(echo "$out" | grep -cE '^\s*ok') assertions)"; fi
done
exit $fail
