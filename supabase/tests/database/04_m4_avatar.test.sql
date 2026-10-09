begin;
select plan(11);

select tests.create_user('00000000-0000-0000-0000-0000000000d1', 'hair@example.com');
select tests.act_as('00000000-0000-0000-0000-0000000000d1');
select public.complete_profile('hairy', 'Hairy', 'GB', '16-17', tests.avatar(), 'Europe/London');

select lives_ok(
  $$ update public.profiles set avatar = tests.avatar() || '{"hair":"curly"}' where id = auth.uid() $$,
  'a known hairstyle is accepted');
select is((select avatar ->> 'hair' from public.profiles where id = auth.uid()), 'curly', 'and stored');
select throws_ok(
  $$ update public.profiles set avatar = tests.avatar() || '{"hair":"mohawk"}' where id = auth.uid() $$,
  '23514', null, 'an unknown hairstyle is rejected');
select lives_ok(
  $$ update public.profiles set avatar = tests.avatar() where id = auth.uid() $$,
  'avatars without a hairstyle still work');

select lives_ok(
  $$ update public.profiles set avatar = jsonb_set(tests.avatar(), '{colors,accent}', '"#E0654A"')
       || '{"outfit":{"top":"hoodie","bottom":"skirt"},"accessories":["beanie","glasses","scarf"]}'
     where id = auth.uid() $$,
  'an outfit, an accent color and starter accessories are accepted');
select throws_ok(
  $$ update public.profiles set avatar = tests.avatar() || '{"outfit":{"top":"tuxedo"}}' where id = auth.uid() $$,
  '23514', null, 'unknown outfit pieces are rejected');
select throws_ok(
  $$ update public.profiles set avatar = tests.avatar() || '{"accessories":["crown"]}' where id = auth.uid() $$,
  '23514', null, 'unknown accessories are rejected');
select throws_ok(
  $$ update public.profiles set avatar = tests.avatar() || '{"accessories":["beanie","cap"]}' where id = auth.uid() $$,
  '23514', null, 'only one hat at a time');
select throws_ok(
  $$ update public.profiles set avatar = jsonb_set(tests.avatar(), '{colors,accent}', '"red"') where id = auth.uid() $$,
  '23514', null, 'the accent color must be a hex color');

select throws_ok(
  $$ update public.profiles set avatar = tests.avatar() || '{"bio":"hidden message"}' where id = auth.uid() $$,
  '23514', null, 'unknown avatar fields are rejected (no hidden text channel)');
select throws_ok(
  $$ update public.profiles set avatar = tests.avatar() || '{"hair":null}' where id = auth.uid() $$,
  '23514', null, 'a JSON null does not slip through the checks');

select * from finish();
rollback;
