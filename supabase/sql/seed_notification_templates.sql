-- Starter templates for the Templates panel on the Notifications dashboard
-- page (app/dashboard/notifications/actions.ts). The notification_templates
-- table (see notification_templates.sql) currently has zero rows, so admins
-- have nothing to pick from when composing a broadcast. This seeds a handful
-- of common ones to start from.
--
-- `**bold**` markup is supported by the app (stripped for the OS push body,
-- rendered inline in the in-app inbox) — see stripBoldMarkup in actions.ts.
--
-- Idempotent: each insert is skipped if a template with the same name
-- already exists, so this file is safe to run more than once.

insert into notification_templates (name, title, body)
select 'Welcome', 'Welcome', '**Welcome to Sterling!** We''re glad you''re here. Explore communities, connect with others, and make the most of your network.'
where not exists (select 1 from notification_templates where name = 'Welcome');

insert into notification_templates (name, title, body)
select 'Scheduled maintenance', 'Scheduled maintenance', 'We''re performing scheduled maintenance. **The app may be briefly unavailable** during this time. Thanks for your patience!'
where not exists (select 1 from notification_templates where name = 'Scheduled maintenance');

insert into notification_templates (name, title, body)
select 'New feature announcement', 'New feature announcement', '**New feature alert!** Check out what''s new in the latest update — open the app to explore.'
where not exists (select 1 from notification_templates where name = 'New feature announcement');

insert into notification_templates (name, title, body)
select 'Event reminder', 'Event reminder', '**Don''t miss out!** You have an upcoming event on Sterling. Open the app for details.'
where not exists (select 1 from notification_templates where name = 'Event reminder');

insert into notification_templates (name, title, body)
select 'Community guidelines reminder', 'Community guidelines reminder', 'A quick reminder to **keep interactions respectful** and follow our community guidelines. Thanks for helping us build a great community!'
where not exists (select 1 from notification_templates where name = 'Community guidelines reminder');

insert into notification_templates (name, title, body)
select 'Re-engagement', 'Re-engagement', '**We miss you!** Come back and see what''s new in your communities and connections.'
where not exists (select 1 from notification_templates where name = 'Re-engagement');
