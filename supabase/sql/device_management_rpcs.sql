-- Run this in the Supabase SQL editor (or via CLI migration).
-- Adds RPCs backing the "Devices" section on the user edit panel:
--   admin_get_user_devices   — devices tied to a given user, with ban + linked-account info
--   admin_get_device_accounts — every account that has logged in from a given device
--   admin_ban_device        — bans a single device (independent of a full user ban)
--   admin_unban_device      — lifts an active ban on a single device
--
-- Assumes existing tables:
--   device_identifiers(id, user_id, device_id, platform, app_version, created_at, last_seen_at)
--   device_bans(id, device_id, banned_by, reason, linked_user_id, is_active, expires_at, created_at)

create or replace function admin_get_user_devices(p_user_id uuid)
returns table (
  device_id text,
  platform text,
  app_version text,
  created_at timestamptz,
  last_seen_at timestamptz,
  is_banned boolean,
  ban_expires_at timestamptz,
  linked_account_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    di.device_id,
    di.platform,
    di.app_version,
    di.created_at,
    di.last_seen_at,
    (active_ban.id is not null) as is_banned,
    active_ban.expires_at as ban_expires_at,
    (
      select count(distinct di2.user_id)
      from device_identifiers di2
      where di2.device_id = di.device_id
        and di2.user_id <> p_user_id
    ) as linked_account_count
  from device_identifiers di
  left join lateral (
    select db.id, db.expires_at
    from device_bans db
    where db.device_id = di.device_id
      and db.is_active
      and (db.expires_at is null or db.expires_at > now())
    order by db.created_at desc
    limit 1
  ) active_ban on true
  where di.user_id = p_user_id
  order by di.last_seen_at desc nulls last;
$$;

create or replace function admin_get_device_accounts(p_device_id text)
returns table (
  user_id uuid,
  full_name text,
  email text,
  username text,
  account_role text,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.full_name,
    p.email,
    p.username,
    p.account_role,
    di.last_seen_at
  from device_identifiers di
  join profiles p on p.id = di.user_id
  where di.device_id = p_device_id
  order by di.last_seen_at desc nulls last;
$$;

create or replace function admin_ban_device(
  p_device_id text,
  p_reason text,
  p_expires_at timestamptz default null,
  p_linked_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update device_bans
  set is_active = false
  where device_id = p_device_id
    and is_active;

  insert into device_bans (device_id, banned_by, reason, linked_user_id, is_active, expires_at, created_at)
  values (p_device_id, auth.uid(), p_reason, p_linked_user_id, true, p_expires_at, now());
end;
$$;

create or replace function admin_unban_device(p_device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update device_bans
  set is_active = false
  where device_id = p_device_id
    and is_active;
end;
$$;
