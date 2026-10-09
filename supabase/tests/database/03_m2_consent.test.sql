begin;
select plan(16);

select tests.create_user('00000000-0000-0000-0000-0000000000c1', 'kid@example.com');
select tests.create_user('00000000-0000-0000-0000-0000000000c2', 'old@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000c1');
select public.complete_profile('kid', 'Kid', 'DE', '14', tests.avatar(), 'Europe/Berlin');

select throws_ok($$ select public.request_parental_consent('not-an-email') $$, 'invalid_email', 'parent email is validated');
select throws_ok($$ select public.request_parental_consent('KID@example.com') $$, 'parent_email_is_yours',
  'the parent email cannot be your own');
select lives_ok($$ select public.request_parental_consent('Parent@Example.com') $$, 'a pending user asks a parent');
select throws_ok($$ select public.request_parental_consent('parent@example.com') $$, 'rate_limited',
  'resends are throttled');

select tests.act_as_service();
select is((select payload ->> 'to' from public.notify_queue where kind = 'consent_email'), 'parent@example.com',
  'a consent email is queued, lowercased');
select is((select parent_email_hash from public.parental_consents), private.sha256_hex('parent@example.com'),
  'the parent email is also kept as a hash');
create temp table t_tok as select payload ->> 'token' as token from public.notify_queue where kind = 'consent_email';
grant select on t_tok to anon;
select isnt((select token_hash from public.parental_consents), (select token from t_tok), 'only the token hash is stored');

set local role anon;
select is((public.consent_view((select token from t_tok)) ->> 'child_display_name'), 'Kid', 'the parent page shows the child''s name');
select is((public.consent_view((select token from t_tok)) ->> 'state'), 'pending', 'and the request state');
select throws_ok($$ select public.consent_view('wrong') $$, 'consent_not_found', 'wrong tokens reveal nothing');
select is(public.consent_decide((select token from t_tok), 'grant'), 'granted', 'the parent grants consent');

select tests.act_as_service();
select is((select consent_status from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), 'granted',
  'the account becomes active');
select is((select parent_email from public.parental_consents), null, 'the plain parent email is cleared after deciding');

set local role anon;
select is(public.consent_decide((select token from t_tok), 'withdraw'), 'deleted', 'the parent can withdraw later');
select tests.act_as_service();
select is((select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000c1'), 0,
  'withdrawing deletes the account');

-- Expiry: a pending account with no answer for 7 days is deleted by tick()
select tests.act_as('00000000-0000-0000-0000-0000000000c2');
select public.complete_profile('old_kid', 'Old', 'FR', '13', tests.avatar(), 'Europe/Paris');
select tests.act_as_service();
update public.profiles set created_at = now() - interval '8 days' where id = '00000000-0000-0000-0000-0000000000c2';
select is((private.tick() ->> 'consent_expired')::int, 1, 'unanswered pending accounts expire after 7 days');

select * from finish();
rollback;
