-- Run this in the Supabase SQL editor (or via CLI migration).
-- Adds a two-tier automatic response to mass-reported posts, gated by
-- DISTINCT DEVICES (not just distinct accounts) reporting the same post —
-- same anti-multi-accounting reasoning as admin_get_shared_devices()
-- (suspicious_accounts.sql), so a handful of throwaway accounts on one
-- phone can't trigger this.
--
-- Tier 1 (>=5 distinct devices): posts.status -> 'auto_hidden'.
--   IMPORTANT: confirm the mobile app's feed query actually excludes
--   status = 'auto_hidden'. If it doesn't filter on that value, either
--   update the app's query, or change the literal below to 'removed'
--   (the value the existing manual removePost() action already uses and
--   is proven to hide content).
--
-- Tier 2 (>=15 distinct devices): additionally calls the existing
-- admin_ban_user() RPC on the post's author with a 7-day expiry (temporary,
-- reversible — never permanent) and p_also_ban_devices = false (a human
-- decides on devices once they review).
--
-- Both tiers are one-shot per post/user: guarded by checking audit_logs
-- for an existing entry, so additional reports past the threshold don't
-- re-fire or spam the log. Both log to audit_logs directly (category
-- 'system', actor_label 'auto-moderation') since triggers can't call the
-- app's logAdminAction() helper (app/dashboard/lib/audit-log.ts).
--
-- Assumes: reports(id, reporter_id, report_type, post_id, status, created_at),
-- device_identifiers(user_id, device_id), posts(id, author_id, status),
-- audit_logs(category, action, detail, target_type, target_id, actor_label),
-- and the existing admin_ban_user(p_user_id, p_reason, p_ban_type,
-- p_expires_at, p_also_ban_devices) RPC used by banned-users/actions.ts.

create or replace function fn_auto_moderate_post_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_count integer;
  v_author_id uuid;
begin
  if NEW.report_type <> 'post' or NEW.post_id is null then
    return NEW;
  end if;

  select count(distinct di.device_id)
  into v_device_count
  from device_identifiers di
  where di.user_id in (
    select distinct r.reporter_id
    from reports r
    where r.post_id = NEW.post_id
      and r.report_type = 'post'
  );

  -- Tier 1: auto-hide the post
  if v_device_count >= 5
     and not exists (
       select 1 from audit_logs
       where action = 'auto_hide_post' and target_id = NEW.post_id::text
     )
  then
    update posts
    set status = 'auto_hidden'
    where id = NEW.post_id
      and status is distinct from 'removed';

    insert into audit_logs (category, action, detail, target_type, target_id, actor_label)
    values (
      'system',
      'auto_hide_post',
      format('Post auto-hidden after reports from %s distinct devices', v_device_count),
      'post',
      NEW.post_id::text,
      'auto-moderation'
    );
  end if;

  -- Tier 2: auto-suspend the author (temporary, reversible — never permanent)
  if v_device_count >= 15 then
    select author_id into v_author_id from posts where id = NEW.post_id;

    if v_author_id is not null and not exists (
      select 1 from audit_logs
      where action = 'auto_suspend_user' and target_id = v_author_id::text
    ) then
      perform admin_ban_user(
        p_user_id => v_author_id,
        p_reason => format('Auto-suspended: post reported by %s distinct devices', v_device_count),
        p_ban_type => 'general',
        p_expires_at => now() + interval '7 days',
        p_also_ban_devices => false
      );

      insert into audit_logs (category, action, detail, target_type, target_id, actor_label)
      values (
        'system',
        'auto_suspend_user',
        format('User auto-suspended for 7 days after a post was reported by %s distinct devices', v_device_count),
        'user',
        v_author_id::text,
        'auto-moderation'
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_moderate_post_report on reports;
create trigger trg_auto_moderate_post_report
  after insert on reports
  for each row
  execute function fn_auto_moderate_post_report();
