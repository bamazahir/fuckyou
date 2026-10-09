-- M5 follow-up: the room bank ledger names who gave what. Nothing in the app reads it (the balance
-- comes from room_info), so members don't get to either: less personal data on show (users are minors).
drop policy room_bank_ledger_members on public.room_bank_ledger;
revoke select on table public.room_bank_ledger from authenticated;
