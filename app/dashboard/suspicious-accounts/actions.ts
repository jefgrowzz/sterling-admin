"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { strikeUser as strikeUserAction, banUser as banUserAction } from "@/app/dashboard/moderation/actions";

export type SuspicionLevel = "High" | "Medium" | "Low";

export type SuspiciousAccount = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  account_role: string;
  created_at: string;
  score: number;
  level: SuspicionLevel;
  signals: string[];
};

const BURST_WINDOW_MS = 10 * 60 * 1000;
const BURST_MIN_POSTS = 5;
const DUPLICATE_MIN_POSTS = 3;
const NEW_ACCOUNT_MAX_AGE_DAYS = 3;
const NEW_ACCOUNT_MIN_POSTS = 10;
const NO_PROFILE_MIN_POSTS = 5;

function levelFromScore(score: number): SuspicionLevel {
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

function hasPostBurst(timestamps: number[]): { hit: boolean; windowCount: number } {
  const sorted = [...timestamps].sort((a, b) => a - b);
  let left = 0;
  let best = 0;
  for (let right = 0; right < sorted.length; right++) {
    while (sorted[right] - sorted[left] > BURST_WINDOW_MS) left++;
    const windowCount = right - left + 1;
    if (windowCount > best) best = windowCount;
  }
  return { hit: best >= BURST_MIN_POSTS, windowCount: best };
}

function maxDuplicateGroup(bodies: (string | null)[]): number {
  const counts: Record<string, number> = {};
  let max = 0;
  for (const body of bodies) {
    const key = (body ?? "").trim().toLowerCase().slice(0, 80);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
    if (counts[key] > max) max = counts[key];
  }
  return max;
}

export async function fetchSuspiciousAccounts(): Promise<SuspiciousAccount[]> {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [profilesRes, postsRes, dismissalsRes, sharedDevicesRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,username,account_role,created_at,avatar_url,bio"),
    supabaseAdmin
      .from("posts")
      .select("author_id,body,created_at")
      .gte("created_at", monthAgo),
    supabaseAdmin.from("suspicious_account_dismissals").select("user_id"),
    supabaseAdmin.rpc("admin_get_shared_devices"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (postsRes.error) throw new Error(postsRes.error.message);
  if (dismissalsRes.error) throw new Error(dismissalsRes.error.message);
  if (sharedDevicesRes.error) throw new Error(sharedDevicesRes.error.message);

  const profiles = (profilesRes.data ?? []) as {
    id: string;
    email: string | null;
    full_name: string | null;
    username: string | null;
    account_role: string | null;
    created_at: string;
    avatar_url: string | null;
    bio: string | null;
  }[];
  const posts = (postsRes.data ?? []) as { author_id: string | null; body: string | null; created_at: string }[];
  const dismissedIds = new Set((dismissalsRes.data ?? []).map((r: { user_id: string }) => r.user_id));
  const sharedDevices = (sharedDevicesRes.data ?? []) as { device_id: string; user_ids: string[]; account_count: number }[];

  // user_id -> extra linked accounts across any shared device (max, not sum)
  const extraLinkedAccounts = new Map<string, number>();
  for (const row of sharedDevices) {
    for (const userId of row.user_ids) {
      const extra = row.account_count - 1;
      extraLinkedAccounts.set(userId, Math.max(extraLinkedAccounts.get(userId) ?? 0, extra));
    }
  }

  const postsByAuthor = new Map<string, { body: string | null; created_at: string }[]>();
  for (const post of posts) {
    if (!post.author_id) continue;
    const list = postsByAuthor.get(post.author_id) ?? [];
    list.push({ body: post.body, created_at: post.created_at });
    postsByAuthor.set(post.author_id, list);
  }

  const results: SuspiciousAccount[] = [];

  for (const profile of profiles) {
    if (dismissedIds.has(profile.id)) continue;

    const signals: string[] = [];
    let score = 0;

    const extra = extraLinkedAccounts.get(profile.id) ?? 0;
    if (extra >= 1) {
      score += Math.min(30 + extra * 15, 60);
      signals.push(`Shares device with ${extra} other account${extra === 1 ? "" : "s"}`);
    }

    const authorPosts = postsByAuthor.get(profile.id) ?? [];

    if (authorPosts.length > 0) {
      const { hit, windowCount } = hasPostBurst(authorPosts.map((p) => new Date(p.created_at).getTime()));
      if (hit) {
        score += 25;
        signals.push(`${windowCount} posts within 10 minutes`);
      }

      const accountAgeDays = (Date.now() - new Date(profile.created_at).getTime()) / (24 * 60 * 60 * 1000);
      if (accountAgeDays < NEW_ACCOUNT_MAX_AGE_DAYS && authorPosts.length > NEW_ACCOUNT_MIN_POSTS) {
        score += 20;
        signals.push(`${authorPosts.length} posts within ${Math.floor(accountAgeDays)}-day-old account`);
      }

      const dupCount = maxDuplicateGroup(authorPosts.map((p) => p.body));
      if (dupCount >= DUPLICATE_MIN_POSTS) {
        score += 20;
        signals.push(`Duplicate content ×${dupCount}`);
      }

      if (!profile.avatar_url && !profile.bio && authorPosts.length > NO_PROFILE_MIN_POSTS) {
        score += 10;
        signals.push("No profile photo or bio despite high posting activity");
      }
    }

    if (score > 0) {
      results.push({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        username: profile.username,
        account_role: profile.account_role ?? "member",
        created_at: profile.created_at,
        score,
        level: levelFromScore(score),
        signals,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export async function dismissSuspiciousAccount(userId: string, dismissedBy?: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("suspicious_account_dismissals")
    .upsert({ user_id: userId, dismissed_by: dismissedBy ?? null, dismissed_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export const strikeUser = strikeUserAction;
export const banUser = banUserAction;
