-- Run this in the Supabase SQL editor (or via CLI migration).
-- Creates the audit_logs table backing the Audit Logs dashboard page and
-- the fetchDashboardMetrics() "modActions" count (app/dashboard/lib/metrics.ts).
--
-- actor_id/actor_label are nullable: server actions don't yet thread the
-- signed-in admin's identity through to logAdminAction(), so entries are
-- logged with a null actor for now. Wire that up once needed.

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('moderation', 'admin', 'security', 'system')),
  action text not null,
  actor_id uuid references profiles(id) on delete set null,
  actor_label text,
  target_type text,
  target_id text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);
create index if not exists audit_logs_category_idx on audit_logs (category);

alter table audit_logs enable row level security;
-- No policies are added: all reads/writes go through the service-role
-- client (supabaseAdmin), which bypasses RLS. This denies anon/authenticated
-- key access by default.
