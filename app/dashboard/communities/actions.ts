"use server";

import { supabaseAdmin } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export type Community = {
  id: string;
  name: string | null;
  description: string | null;
  members_count: number;
  created_at: string | null;
};

export type CommunityMember = {
  user_id: string;
  role: string;
  profile: {
    full_name: string | null;
    username: string | null;
    email: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchCommunities(
  page: number,
  search = ""
): Promise<{ communities: Community[]; totalCount: number }> {
  const offset = (page - 1) * PAGE_SIZE;

  let countQuery = supabaseAdmin
    .from("communities")
    .select("*", { count: "exact", head: true });

  let dataQuery = supabaseAdmin
    .from("communities")
    .select("id,name,description,members_count,created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (search.trim()) {
    const term = search.trim();
    countQuery = countQuery.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    dataQuery = dataQuery.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (error) throw new Error(error.message);

  return {
    communities: (data ?? []) as Community[],
    totalCount: count ?? 0,
  };
}

export async function fetchCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  const { data, error } = await supabaseAdmin
    .from("community_members")
    .select("user_id,role,profiles(full_name,username,email)")
    .eq("community_id", communityId)
    .order("role", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    profile: m.profiles,
  }));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function updateCommunity(
  id: string,
  updates: Partial<Community>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("communities")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCommunity(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("communities")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeCommunityMember(communityId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function updateCommunityMemberRole(
  communityId: string,
  userId: string,
  role: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("community_members")
    .update({ role })
    .eq("community_id", communityId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}