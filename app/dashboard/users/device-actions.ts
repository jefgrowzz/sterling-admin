"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { logAdminAction } from "@/app/dashboard/lib/audit-log";

export type UserDevice = {
  device_id: string;
  platform: string | null;
  app_version: string | null;
  created_at: string;
  last_seen_at: string | null;
  is_banned: boolean;
  ban_expires_at: string | null;
  linked_account_count: number;
};

export type DeviceAccount = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  account_role: string | null;
  last_seen_at: string | null;
};

export async function fetchUserDevices(userId: string): Promise<UserDevice[]> {
  const { data, error } = await supabaseAdmin.rpc("admin_get_user_devices", {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchDeviceAccounts(deviceId: string): Promise<DeviceAccount[]> {
  const { data, error } = await supabaseAdmin.rpc("admin_get_device_accounts", {
    p_device_id: deviceId,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function banDevice(params: {
  deviceId: string;
  reason: string;
  expiresAt: string | null;
  linkedUserId?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("admin_ban_device", {
    p_device_id: params.deviceId,
    p_reason: params.reason,
    p_expires_at: params.expiresAt,
    p_linked_user_id: params.linkedUserId ?? null,
  });
  if (error) throw new Error(error.message);

  await logAdminAction({
    category: "security",
    action: "ban_device",
    detail: `Banned device ${params.deviceId}: ${params.reason}`,
    targetType: "device",
    targetId: params.deviceId,
  });
}

export async function unbanDevice(deviceId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("admin_unban_device", {
    p_device_id: deviceId,
  });
  if (error) throw new Error(error.message);

  await logAdminAction({
    category: "security",
    action: "unban_device",
    detail: `Lifted ban on device ${deviceId}`,
    targetType: "device",
    targetId: deviceId,
  });
}
