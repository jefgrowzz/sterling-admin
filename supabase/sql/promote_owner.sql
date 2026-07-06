-- 1. In the Supabase dashboard: Authentication -> Users -> Add user,
--    create an account with your email + a password (or use one that
--    already exists in auth.users).
--
-- 2. Run this in the SQL editor, swapping in that email. Most Supabase
--    setups auto-create a profiles row via a trigger on signup, so this
--    UPDATE should be enough:

update profiles
set account_role = 'owner'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');

-- 3. Check it worked:

select id, email, account_role from profiles
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');

-- If step 3 returns 0 rows, there's no profiles row for that auth user
-- (no trigger, or it hasn't fired). Create one manually instead:
--
-- insert into profiles (id, email, account_role)
-- select id, email, 'owner'
-- from auth.users
-- where email = 'YOUR_EMAIL_HERE'
-- on conflict (id) do update set account_role = excluded.account_role;
--
-- If that insert errors on a NOT NULL column, tell me which one and I'll
-- adjust it — I don't have visibility into every column/constraint on
-- profiles from this repo.
