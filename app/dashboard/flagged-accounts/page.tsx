"use client";

import { useState, useEffect } from "react";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Report } from "@/lib/types";
import { Tabs } from "@/components/dashboard/Tabs";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Pagination } from "@/components/ui/Pagination";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlaggedUser = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  username?: string | null;
  account_role: string;
  moderation_strike_count: number;
  created_at: string;
};

type Severity = "Critical" | "High" | "Medium" | "Low";

type PostEntry = {
  id: string;
  body?: string | null;
  author_username?: string | null;
  community_name?: string | null;
  likes_count?: number | null;
  comments_count?: number | null;
  image_urls?: string[] | null;
  post_type?: string | null;
};

type ReportedPostEntry = {
  id: string;
  category?: string | null;
  description?: string | null;
  status?: string | null;
  review_priority?: string | null;
  offense_label?: string | null;
  created_at?: string;
  post_id?: string | null;
  post: PostEntry | null;
};

// ---------------------------------------------------------------------------
// Data — flagged accounts
// ---------------------------------------------------------------------------

async function fetchFlaggedProfiles(): Promise<FlaggedUser[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,username,account_role,moderation_strike_count,created_at")
    .gt("moderation_strike_count", 0)
    .order("moderation_strike_count", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((p: any) => ({
    ...p,
    account_role: p.account_role ?? "member",
    moderation_strike_count: p.moderation_strike_count ?? 0,
  }));
}

async function fetchUserReports(userId: string): Promise<Report[]> {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("id,category,description,status,review_priority,offense_label,created_at,reporter_id,report_type")
    .eq("reported_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function updateStrikes(userId: string, count: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ moderation_strike_count: count })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

async function banUser(userId: string, reason?: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("admin_ban_user", {
      p_user_id: userId,
      p_reason: reason || "Violation of platform rules",
      p_also_ban_devices: true,
    });

    if (error) {
      // If RPC doesn't exist, fall back to direct update
      if (error.message?.includes("function") || error.message?.includes("does not exist")) {
        console.warn("admin_ban_user RPC not found, falling back to direct update");
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            account_role: "banned",
            ban_reason: reason || "Violation of platform rules",
            banned_at: new Date().toISOString()
          })
          .eq("id", userId);

        if (updateError) throw new Error(updateError.message);
        return;
      }
      throw new Error(error.message);
    }
  } catch (error: any) {
    console.error("Ban user error:", error);
    throw new Error(error.message || "Failed to ban user");
  }
}

// ---------------------------------------------------------------------------
// Data — reported posts
// ---------------------------------------------------------------------------

async function fetchReportedPosts(): Promise<ReportedPostEntry[]> {
  const { data: reports, error } = await supabaseAdmin
    .from("reports")
    .select("id,category,description,status,review_priority,offense_label,created_at,post_id")
    .not("post_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  if (!reports?.length) return [];

  const postIds = [...new Set((reports as any[]).map((r) => r.post_id).filter(Boolean))];
  const { data: posts } = await supabaseAdmin
    .from("posts")
    .select("id,body,author_username,community_name,likes_count,comments_count,image_urls,post_type")
    .in("id", postIds);

  const postMap: Record<string, PostEntry> = Object.fromEntries(
    (posts ?? []).map((p: any) => [p.id, p])
  );

  return (reports as any[]).map((r) => ({
    ...r,
    post: r.post_id ? (postMap[r.post_id] ?? null) : null,
  }));
}

async function dismissReport(reportId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("reports")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
}

async function removePost(reportId: string, postId: string): Promise<void> {
  const [r1, r2] = await Promise.all([
    supabaseAdmin.from("reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", reportId),
    supabaseAdmin.from("posts").update({ status: "removed" }).eq("id", postId),
  ]);
  if (r1.error) throw new Error(r1.error.message);
  if (r2.error) throw new Error(r2.error.message);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeverity(strikes: number): Severity {
  if (strikes >= 5) return "Critical";
  if (strikes >= 3) return "High";
  if (strikes >= 2) return "Medium";
  return "Low";
}

function getInitials(name?: string | null, username?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return (username ?? "??").slice(0, 2).toUpperCase();
}

const AVATAR_PALETTES = [
  "bg-violet-500/15 text-violet-300",
  "bg-blue-500/15 text-blue-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-amber-500/15 text-amber-300",
  "bg-rose-500/15 text-rose-300",
];

function avatarColor(id: string): string {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function joinedLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const SEVERITY_BADGE: Record<Severity, string> = {
  Critical: "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40",
  High:     "bg-rose-500/15 text-rose-300",
  Medium:   "bg-amber-500/15 text-amber-300",
  Low:      "bg-zinc-800 text-zinc-400",
};

const SEVERITY_DOT: Record<Severity, string> = {
  Critical: "bg-rose-500",
  High:     "bg-rose-400",
  Medium:   "bg-amber-400",
  Low:      "bg-zinc-600",
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-300",
  high:     "bg-rose-500/15 text-rose-300",
  medium:   "bg-amber-500/15 text-amber-300",
  low:      "bg-zinc-800 text-zinc-400",
};

const STATUS_STYLE: Record<string, { badge: string; dot: string }> = {
  open:         { badge: "bg-amber-500/15 text-amber-300",   dot: "bg-amber-400" },
  pending:      { badge: "bg-amber-500/15 text-amber-300",   dot: "bg-amber-400" },
  under_review: { badge: "bg-blue-500/15 text-blue-300",     dot: "bg-blue-400" },
  in_progress:  { badge: "bg-blue-500/15 text-blue-300",     dot: "bg-blue-400" },
  resolved:     { badge: "bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400" },
  dismissed:    { badge: "bg-zinc-800 text-zinc-400",        dot: "bg-zinc-600" },
};

function normalizeStatus(s?: string | null) {
  return (s ?? "pending").toLowerCase().replace(/\s+/g, "_");
}

function StatusBadge({ status }: { status?: string | null }) {
  const key = normalizeStatus(status);
  const style = STATUS_STYLE[key] ?? STATUS_STYLE.pending;
  const label = (status ?? "pending").replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${style.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 shrink-0 rounded-full bg-zinc-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-zinc-700" />
          <div className="h-3 w-56 rounded bg-zinc-700" />
          <div className="h-3 w-32 rounded bg-zinc-700" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-zinc-700" />
          <div className="h-6 w-16 rounded-full bg-zinc-700" />
          <div className="h-8 w-20 rounded-full bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded bg-zinc-700" />
        <div className="h-5 w-14 rounded-full bg-zinc-700" />
      </div>
      <div className="mt-4 h-8 w-12 rounded bg-zinc-700" />
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-2 rounded-xl border border-zinc-800 bg-zinc-800/60 p-4">
      <div className="flex justify-between">
        <div className="h-3 w-20 rounded bg-zinc-700" />
        <div className="h-5 w-14 rounded-full bg-zinc-700" />
      </div>
      <div className="h-4 w-3/4 rounded bg-zinc-700" />
      <div className="h-3 w-24 rounded bg-zinc-700" />
    </div>
  );
}

function PostCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-zinc-700" />
          <div className="h-5 w-12 rounded-full bg-zinc-700" />
          <div className="h-5 w-14 rounded-full bg-zinc-700" />
        </div>
        <div className="h-4 w-20 rounded bg-zinc-700" />
      </div>
      <div className="mt-3 space-y-2 rounded-xl border border-zinc-800 bg-zinc-800/60 p-4">
        <div className="h-4 w-full rounded bg-zinc-700" />
        <div className="h-4 w-4/5 rounded bg-zinc-700" />
        <div className="mt-2 flex gap-3">
          <div className="h-3 w-16 rounded bg-zinc-700" />
          <div className="h-3 w-24 rounded bg-zinc-700" />
          <div className="h-3 w-20 rounded bg-zinc-700" />
        </div>
      </div>
      <div className="mt-3 h-4 w-2/3 rounded bg-zinc-700" />
      <div className="mt-4 flex items-center justify-between">
        <div className="h-6 w-28 rounded-full bg-zinc-700" />
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-full bg-zinc-700" />
          <div className="h-7 w-24 rounded-full bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review panel (flagged accounts)
// ---------------------------------------------------------------------------

function ReviewPanel({
  user,
  onClose,
  onStrikesChanged,
}: {
  user: FlaggedUser;
  onClose: () => void;
  onStrikesChanged: (userId: string, newCount: number) => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [actionState, setActionState] = useState<"idle" | "working" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [localStrikes, setLocalStrikes] = useState(user.moderation_strike_count);

  const severity = getSeverity(localStrikes);

  useEffect(() => {
    fetchUserReports(user.id)
      .then(setReports)
      .catch(console.error)
      .finally(() => setReportsLoading(false));
  }, [user.id]);

  async function handleStrikeAction(newCount: number) {
    setActionState("working");
    setActionError(null);
    try {
      await updateStrikes(user.id, newCount);
      setLocalStrikes(newCount);
      onStrikesChanged(user.id, newCount);
    } catch (e: any) {
      setActionError(e.message);
      setActionState("error");
      return;
    }
    setActionState("idle");
  }

  async function handleBanUser() {
    setActionState("working");
    setActionError(null);
    try {
      await banUser(user.id, `Banned from flagged accounts review (strikes: ${user.moderation_strike_count})`);
      onStrikesChanged(user.id, 0);
      onClose();
    } catch (e: any) {
      setActionError(e.message);
      setActionState("error");
    }
  }

  const initials = getInitials(user.full_name, user.username);
  const color = avatarColor(user.id);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-hidden bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${color}`}>
              {initials}
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-50">
                {user.full_name ?? user.username ?? "Unknown user"}
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500">{user.email ?? "No email"}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${SEVERITY_BADGE[severity]}`}>
                  {severity}
                </span>
                <span className="text-xs text-zinc-500">
                  {localStrikes} strike{localStrikes !== 1 ? "s" : ""} · {user.account_role}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-800/60 px-6 py-4">
          <div className="flex items-center gap-3">
            {Array.from({ length: Math.max(localStrikes, 5) }).map((_, i) => (
              <div key={i} className={`h-2.5 w-2.5 rounded-full ${i < localStrikes ? SEVERITY_DOT[severity] : "bg-zinc-700"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => localStrikes > 0 && handleStrikeAction(localStrikes - 1)} disabled={localStrikes === 0 || actionState === "working"} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40">
              − Strike
            </button>
            <button onClick={() => handleStrikeAction(localStrikes + 1)} disabled={actionState === "working"} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-40">
              + Strike
            </button>
            <button onClick={() => handleStrikeAction(0)} disabled={localStrikes === 0 || actionState === "working"} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40">
              Clear all
            </button>
            <button onClick={handleBanUser} disabled={actionState === "working"} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-40">
              {actionState === "working" ? "Banning…" : "Ban user"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Reports against this user
          </h3>
          {reportsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <ReportSkeleton key={i} />)}</div>
          ) : reports.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
              No reports found for this user
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-zinc-800 bg-zinc-800/60 p-4 transition hover:border-zinc-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {report.category && <span className="text-xs font-semibold text-zinc-300 capitalize">{report.category.replace(/_/g, " ")}</span>}
                          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-300 capitalize">{report.report_type} report</span>
                        </div>
                        {report.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{report.description}</p>}
                        <p className="mt-1.5 text-[11px] text-zinc-500">{report.created_at ? timeAgo(report.created_at) : "—"}</p>
                      </div>
                      {report.status && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 shrink-0">
                          {report.status}
                        </span>
                      )}
                    </div>
                  </div>
              ))}
            </div>
          )}
          {actionError && (
            <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{actionError}</p>
          )}
        </div>

        <div className="border-t border-zinc-800 px-6 py-4">
          <button onClick={onClose} className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800">
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Flagged account card
// ---------------------------------------------------------------------------

function FlaggedCard({ user, onReview }: { user: FlaggedUser; onReview: (u: FlaggedUser) => void }) {
  const severity = getSeverity(user.moderation_strike_count);
  const initials = getInitials(user.full_name, user.username);
  const color = avatarColor(user.id);

  return (
    <div className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm transition hover:border-zinc-700 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${color}`}>
            {initials}
            <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 ${SEVERITY_DOT[severity]}`} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-zinc-50">{user.full_name ?? user.username ?? "Unknown user"}</p>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{user.email ?? "No email on record"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span>Joined {joinedLabel(user.created_at)}</span>
              <span className="inline-block h-1 w-1 rounded-full bg-zinc-600" />
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {user.account_role}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-zinc-900/60">
              <path fillRule="evenodd" d="M8 1a.75.75 0 01.75.75v5.5a.75.75 0 01-1.5 0v-5.5A.75.75 0 018 1zm0 9a1 1 0 110 2 1 1 0 010-2z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold text-zinc-900">
              {user.moderation_strike_count} strike{user.moderation_strike_count !== 1 ? "s" : ""}
            </span>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${SEVERITY_BADGE[severity]}`}>{severity}</span>
          <button onClick={() => onReview(user)} className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800">
            Review
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reported post card
// ---------------------------------------------------------------------------

function ReportedPostCard({
  entry,
  onDismiss,
  onRemove,
}: {
  entry: ReportedPostEntry;
  onDismiss: (reportId: string) => Promise<void>;
  onRemove: (reportId: string, postId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<"dismiss" | "remove" | null>(null);
  const priority = (entry.review_priority ?? "").toLowerCase();
  const { post } = entry;
  const imageCount = post?.image_urls?.length ?? 0;

  async function handle(action: "dismiss" | "remove") {
    setBusy(action);
    try {
      if (action === "dismiss") await onDismiss(entry.id);
      else if (action === "remove" && entry.post_id) await onRemove(entry.id, entry.post_id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm transition hover:border-zinc-700 hover:shadow-md">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {entry.offense_label && (
            <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
              {entry.offense_label}
            </span>
          )}
          {entry.category && (
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {entry.category}
            </span>
          )}
          {entry.review_priority && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${PRIORITY_BADGE[priority] ?? "bg-zinc-800 text-zinc-400"}`}>
              {entry.review_priority}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-zinc-500">{entry.created_at ? timeAgo(entry.created_at) : "—"}</span>
      </div>

      {/* Post preview */}
      {post ? (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-800/60 px-4 py-3">
          {post.body ? (
            <p className="line-clamp-2 text-sm text-zinc-300">{post.body}</p>
          ) : (
            <p className="text-sm italic text-zinc-500">No text content</p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            {post.author_username && (
              <span className="font-medium text-zinc-400">@{post.author_username}</span>
            )}
            {post.community_name && (
              <>
                <span className="h-1 w-1 rounded-full bg-zinc-600" />
                <span>{post.community_name}</span>
              </>
            )}
            {(post.likes_count != null || post.comments_count != null) && (
              <>
                <span className="h-1 w-1 rounded-full bg-zinc-600" />
                <span>{post.likes_count ?? 0} likes · {post.comments_count ?? 0} comments</span>
              </>
            )}
            {imageCount > 0 && (
              <>
                <span className="h-1 w-1 rounded-full bg-zinc-600" />
                <span className="inline-flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path fillRule="evenodd" d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm10 5.414-1.293-1.293a1 1 0 00-1.414 0L7 10.414 5.707 9.121a1 1 0 00-1.414 0L3 10.414V12h9v-2.586zM9 7a1 1 0 112 0 1 1 0 01-2 0z" clipRule="evenodd" />
                  </svg>
                  {imageCount} {imageCount === 1 ? "image" : "images"}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-500">
          Post no longer available or deleted
        </div>
      )}

      {/* Report description */}
      {entry.description && (
        <p className="mt-3 text-sm text-zinc-400">
          <span className="font-medium text-zinc-300">Report: </span>
          <span className="line-clamp-2">{entry.description}</span>
        </p>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <StatusBadge status={entry.status} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => handle("dismiss")}
            disabled={busy !== null}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
          </button>
          {entry.post_id && (
            <button
              onClick={() => handle("remove")}
              disabled={busy !== null}
              className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {busy === "remove" ? "Removing…" : "Remove post"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reported posts view
// ---------------------------------------------------------------------------

function isPending(s?: string | null) {
  const k = normalizeStatus(s);
  return !k || k === "open" || k === "pending";
}
function isUnderReview(s?: string | null) {
  const k = normalizeStatus(s);
  return k === "under_review" || k === "in_progress" || k === "review_started";
}
function isResolved(s?: string | null) {
  const k = normalizeStatus(s);
  return k === "resolved" || k === "dismissed";
}

function ReportedPostsView() {
  const [entries, setEntries] = useState<ReportedPostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState("pending");

  useEffect(() => {
    fetchReportedPosts()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleDismiss(reportId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== reportId));
    await dismissReport(reportId).catch(console.error);
  }

  async function handleRemove(reportId: string, postId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== reportId));
    await removePost(reportId, postId).catch(console.error);
  }

  const pendingEntries  = entries.filter((e) => isPending(e.status));
  const reviewEntries   = entries.filter((e) => isUnderReview(e.status));
  const resolvedEntries = entries.filter((e) => isResolved(e.status));

  const filtered =
    filterTab === "pending"  ? pendingEntries :
    filterTab === "review"   ? reviewEntries :
    filterTab === "resolved" ? resolvedEntries :
    entries;

  const stats = [
    { title: "Total reports",   value: String(entries.length),         change: "active",      tone: "slate"   as const },
    { title: "Pending review",  value: String(pendingEntries.length),  change: "needs action", tone: "amber"   as const },
    { title: "Under review",    value: String(reviewEntries.length),   change: "in progress",  tone: "slate"   as const },
    { title: "Resolved",        value: String(resolvedEntries.length), change: "completed",    tone: "emerald" as const },
  ];

  return (
    <>
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((s) => <StatsCard key={s.title} {...s} />)}
      </div>

      {/* Content */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <Tabs
          tabs={[
            { id: "pending",  label: "Pending",      count: loading ? undefined : pendingEntries.length,  color: "amber"   },
            { id: "review",   label: "Under review", count: loading ? undefined : reviewEntries.length,   color: "blue"    },
            { id: "resolved", label: "Resolved",     count: loading ? undefined : resolvedEntries.length, color: "emerald" },
            { id: "all",      label: "All",          count: loading ? undefined : entries.length,         color: "blue"    },
          ]}
          defaultTab="pending"
          variant="pills"
          size="sm"
          onChange={setFilterTab}
        />

        <div className="mt-6 space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <PostCardSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-zinc-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
              </svg>
              <p className="text-sm text-zinc-500">No reported posts in this category</p>
            </div>
          ) : (
            filtered.map((entry) => (
              <ReportedPostCard
                key={entry.id}
                entry={entry}
                onDismiss={handleDismiss}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const FLAGGED_PAGE_SIZE = 10;

export default function FlaggedAccountsPage() {
  const [pageView, setPageView] = useState<"accounts" | "posts">("accounts");
  const [users, setUsers] = useState<FlaggedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsTab, setAccountsTab] = useState("priority");
  const [reviewing, setReviewing] = useState<FlaggedUser | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchFlaggedProfiles()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleStrikesChanged(userId: string, newCount: number) {
    setUsers((prev) =>
      prev
        .map((u) => (u.id === userId ? { ...u, moderation_strike_count: newCount } : u))
        .filter((u) => u.moderation_strike_count > 0)
        .sort((a, b) => b.moderation_strike_count - a.moderation_strike_count)
    );
    if (reviewing?.id === userId) {
      if (newCount === 0) setReviewing(null);
      else setReviewing((prev) => prev && { ...prev, moderation_strike_count: newCount });
    }
  }

  const critical = users.filter((u) => u.moderation_strike_count >= 5);
  const high     = users.filter((u) => u.moderation_strike_count >= 3 && u.moderation_strike_count < 5);
  const medium   = users.filter((u) => u.moderation_strike_count === 2);
  const low      = users.filter((u) => u.moderation_strike_count === 1);
  const priority = [...critical, ...high];

  const accountList = users.filter((u) => {
    if (accountsTab === "priority") return u.moderation_strike_count >= 3;
    if (accountsTab === "high")     return u.moderation_strike_count >= 3 && u.moderation_strike_count < 5;
    if (accountsTab === "medium")   return u.moderation_strike_count === 2;
    if (accountsTab === "low")      return u.moderation_strike_count === 1;
    return true;
  });

  const accountStats = [
    { title: "Total flagged",  value: loading ? "—" : String(users.length),    change: users.length === 0 ? "none" : "active",   tone: "slate"   as const },
    { title: "Critical (5+)",  value: loading ? "—" : String(critical.length), change: "immediate",                               tone: "rose"    as const },
    { title: "Priority (3–4)", value: loading ? "—" : String(high.length),     change: "review today",                            tone: "amber"   as const },
    { title: "Medium / Low",   value: loading ? "—" : String(medium.length + low.length), change: "monitor",                     tone: "slate"   as const },
  ];

  return (
    <>
      {reviewing && (
        <ReviewPanel
          user={reviewing}
          onClose={() => setReviewing(null)}
          onStrikesChanged={handleStrikesChanged}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-400">Safety</p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
            {pageView === "accounts" ? "Priority review queue" : "Reported posts"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {pageView === "accounts"
              ? "Users with active moderation strikes, ordered by severity. Use the review panel to inspect reports and adjust strikes."
              : "Posts reported by users for policy violations. Dismiss false positives or remove content that violates platform rules."}
          </p>
          <div className="mt-5 border-t border-zinc-800 pt-5">
            <Tabs
              tabs={[
                { id: "accounts", label: "Flagged accounts", color: "rose" },
                { id: "posts",    label: "Reported posts",   color: "amber" },
              ]}
              defaultTab="accounts"
              variant="pills"
              onChange={(id) => setPageView(id as "accounts" | "posts")}
            />
          </div>
        </div>

        {/* Flagged accounts view */}
        {pageView === "accounts" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
                : accountStats.map((s) => <StatsCard key={s.title} {...s} />)}
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
              <Tabs
                tabs={[
                  { id: "priority", label: "Priority",   count: loading ? undefined : priority.length, color: "rose"  },
                  { id: "high",     label: "High",       count: loading ? undefined : high.length,     color: "rose"  },
                  { id: "medium",   label: "Medium",     count: loading ? undefined : medium.length,   color: "amber" },
                  { id: "low",      label: "Low",        count: loading ? undefined : low.length,      color: "blue"  },
                  { id: "all",      label: "All flagged",count: loading ? undefined : users.length,    color: "amber" },
                ]}
                defaultTab="priority"
                variant="segmented"
                size="sm"
                onChange={setAccountsTab}
              />

              <div className="mt-6 space-y-3">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
                ) : accountList.length === 0 ? (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                    No flagged accounts in this category
                  </div>
                ) : (
                  (() => {
                    const paginatedAccounts = accountList.slice(
                      (currentPage - 1) * FLAGGED_PAGE_SIZE,
                      currentPage * FLAGGED_PAGE_SIZE
                    );
                    return (
                      <>
                        {paginatedAccounts.map((user) => (
                          <FlaggedCard key={user.id} user={user} onReview={setReviewing} />
                        ))}
                      </>
                    );
                  })()
                )}
              </div>
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.max(1, Math.ceil(accountList.length / FLAGGED_PAGE_SIZE))}
                  onPageChange={setCurrentPage}
                  totalItems={accountList.length}
                  pageSize={FLAGGED_PAGE_SIZE}
                />
              </div>
            </div>
          </>
        )}

        {/* Reported posts view */}
        {pageView === "posts" && <ReportedPostsView />}
      </div>
    </>
  );
}
