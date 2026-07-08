"use server";

import { supabaseAdmin } from "@/lib/supabase/server";

export type AuditCategory = "moderation" | "admin" | "security" | "system";

// Resolves a user id to something recognizable for audit log detail strings —
// otherwise entries just show a bare UUID with no way to tell who was affected.
export async function describeUser(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email,username,full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.email ?? data?.username ?? data?.full_name ?? userId;
}

export async function logAdminAction(params: {
  category: AuditCategory;
  action: string;
  detail?: string;
  targetType?: string;
  targetId?: string;
  actorId?: string | null;
  actorLabel?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    category: params.category,
    action: params.action,
    detail: params.detail ?? null,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    actor_id: params.actorId ?? null,
    actor_label: params.actorLabel ?? null,
  });

  // A failed audit log write shouldn't block the admin action that triggered it.
  if (error) console.error("[audit-log] failed to record entry:", error.message);
}
