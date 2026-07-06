-- Documents the notification_templates table backing the Templates panel on
-- the Notifications dashboard page (app/dashboard/notifications/actions.ts).
-- This table already exists in Supabase; the create/index statements below
-- are idempotent (if not exists) and only here so the schema is tracked in
-- the repo like the other tables under supabase/sql/.
--
-- `title` is a required column this app doesn't otherwise use (broadcasts
-- always send under the fixed push title "Sterling" — see PUSH_TITLE in
-- actions.ts). The dashboard maps template.name -> title and
-- template.message -> body, since to this app a template is just a name +
-- one reusable message string.

create table if not exists notification_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_templates_name_idx on notification_templates (name);

alter table notification_templates enable row level security;
-- No policies are added: all reads/writes go through the service-role
-- client (supabaseAdmin), which bypasses RLS. This denies anon/authenticated
-- key access by default.
