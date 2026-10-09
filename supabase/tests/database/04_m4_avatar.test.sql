begin;
select plan(4);

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

select * from finish();
rollback;
