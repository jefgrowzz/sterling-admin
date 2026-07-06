"use server";

import { supabaseAdmin } from "@/lib/supabase/server";

export type AuditCategory = "moderation" | "admin" | "security" | "system";

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
