"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/app/dashboard/lib/dal";
import { logAdminAction } from "@/app/dashboard/lib/audit-log";
import type { UserProfile } from "@/lib/types";

const PAGE_SIZE = 20;

export type FetchFilter = { account_role?: string; flagged?: boolean };

export async function fetchProfiles(
  page: number,
  filter: FetchFilter = {},
  search = ""
): Promise<{ profiles: UserProfile[]; totalCount: number }> {
  const offset = (page - 1) * PAGE_SIZE;

  let countQuery = supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true });

  let dataQuery = supabaseAdmin
    .from("profiles")
    .select(
      `id,email,full_name,username,role,operating_markets,market_other,main_goals,created_at,updated_at,avatar_url,banner_url,bio,account_role,moderation_strike_count,phone_number`
    )
    .order("full_name", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filter.account_role) {
    countQuery = countQuery.eq("account_role", filter.account_role);
    dataQuery = dataQuery.eq("account_role", filter.account_role);
  }
  if (filter.flagged) {
    countQuery = countQuery.gt("moderation_strike_count", 0);
    dataQuery = dataQuery.gt("moderation_strike_count", 0);
  }
  if (search.trim()) {
    const term = search.trim();
    countQuery = countQuery.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,username.ilike.%${term}%`
    );
    dataQuery = dataQuery.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,username.ilike.%${term}%`
    );
  }

  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (error) throw new Error(error.message);

  const profiles = (data ?? []).map((profile: any) => ({
    ...profile,
    operating_markets: profile.operating_markets ?? [],
    main_goals: profile.main_goals ?? [],
    account_role: profile.account_role ?? "member",
    moderation_strike_count: profile.moderation_strike_count ?? 0,
  }));

  return { profiles, totalCount: count ?? 0 };
}

// Was previously called directly from the client with supabaseAdmin, which silently
// downgraded to the anon-key client in the browser (SUPABASE_SERVICE_ROLE_KEY isn't
// NEXT_PUBLIC_-prefixed, so it's undefined client-side) and got blocked by RLS —
// this is why promoting a user to "owner" (and likely any cross-user profile edit)
// never actually persisted. Moved server-side so it runs with service-role access.
export async function updateProfile(
  id: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const admin = await getCurrentAdmin();

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("email,full_name,username")
    .single();
  if (error) throw new Error(error.message);

  if (updates.account_role) {
    const label = data?.email ?? data?.username ?? data?.full_name ?? id;
    await logAdminAction({
      category: "admin",
      action: "update_account_role",
      detail: `Set account_role = "${updates.account_role}" for ${label}`,
      targetType: "user",
      targetId: id,
      actorId: admin.id,
      actorLabel: admin.email,
    });
  }
}
