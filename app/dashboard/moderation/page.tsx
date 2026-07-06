"use client";

import { useState, useEffect } from "react";
import type { ReportStatus } from "@/lib/types";
import { Tabs } from "@/components/dashboard/Tabs";
import { Pagination } from "@/components/ui/Pagination";
import {
  fetchQueueStats,
  fetchReports,
  updateReportStatus,
  strikeUser,
  banUser,
  strikePostAuthor,
  banPostAuthor,
  restorePost,
  type EnrichedReport,
  type QueueStats,
} from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  hate_speech:   "Hate Speech",
  harassment:    "Harassment",
  spam:          "Spam",
  misinformation:"Misinformation",
  nudity:        "Nudity",
  violence:      "Violence",
  impersonation: "Impersonation",
  crash:         "App Crash",
  ui_issue:      "UI Issue",
  performance:   "Performance",
  data_loss:     "Data Loss",
  other:         "Other",
};

const CATEGORY_BADGE: Record<string, string> = {
  hate_speech:    "bg-rose-500/15 text-rose-300",
  harassment:     "bg-rose-500/15 text-rose-300",
  violence:       "bg-rose-500/15 text-rose-300",
  nudity:         "bg-rose-500/15 text-rose-300",
  crash:          "bg-rose-500/15 text-rose-300",
  data_loss:      "bg-rose-500/15 text-rose-300",
  spam:           "bg-amber-500/15 text-amber-300",
  impersonation:  "bg-amber-500/15 text-amber-300",
  misinformation: "bg-amber-500/15 text-amber-300",
  ui_issue:       "bg-amber-500/15 text-amber-300",
  performance:    "bg-zinc-800 text-zinc-400",
  other:          "bg-zinc-800 text-zinc-400",
};

const STATUS_BADGE: Record<string, { cls: string; dot: string }> = {
  pending:   { cls: "bg-amber-500/15 text-amber-300",  dot: "bg-amber-400"   },
  reviewed:  { cls: "bg-blue-500/15 text-blue-300",     dot: "bg-blue-400"    },
  dismissed: { cls: "bg-zinc-800 text-zinc-400",        dot: "bg-zinc-600"    },
};

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusChip({ status }: { status: ReportStatus }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function ReportCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-5 w-24 rounded-full bg-zinc-700" />
            <div className="h-5 w-16 rounded-full bg-zinc-700" />
          </div>
          <div className="h-4 w-3/4 rounded bg-zinc-700" />
          <div className="h-3 w-1/2 rounded bg-zinc-700" />
        </div>
        <div className="h-4 w-20 shrink-0 rounded bg-zinc-700" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="h-5 w-20 rounded-full bg-zinc-700" />
        <div className="flex gap-2">
          <div className="h-7 w-28 rounded-full bg-zinc-700" />
          <div className="h-7 w-20 rounded-full bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
      <div className="h-4 w-32 rounded bg-zinc-700" />
      <div className="mt-4 h-9 w-16 rounded bg-zinc-700" />
      <div className="mt-2 h-3 w-24 rounded bg-zinc-700" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report card
// ---------------------------------------------------------------------------

function ReportCard({
  report,
  onAction,
}: {
  report: EnrichedReport;
  onAction?: (id: string, status: ReportStatus) => Promise<void>;
}) {
  const [busy, setBusy] = useState<ReportStatus | "strike" | "ban" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  async function handle(action: ReportStatus | "strike" | "ban" | "restore") {
    if (!onAction && action !== "strike" && action !== "ban" && action !== "restore") return;
    setBusy(action);
    setError(null);

    try {
      if (action === "restore" && report.post_id) {
        await restorePost(report.post_id, report.id);
        setRestored(true);
      } else if (action === "strike" && report.report_type === "post" && report.post_id) {
        await strikePostAuthor(report.post_id, report.id);
      } else if (action === "ban" && report.report_type === "post" && report.post_id) {
        await banPostAuthor(report.post_id, report.id);
      } else if (action === "strike" && report.reported_user_id) {
        await strikeUser(report.reported_user_id);
        await updateReportStatus(report.id, "reviewed");
      } else if (action === "ban" && report.reported_user_id) {
        await banUser(report.reported_user_id);
        await updateReportStatus(report.id, "reviewed");
      } else if (typeof action === "string" && ["reviewed", "dismissed"].includes(action)) {
        await onAction?.(report.id, action as ReportStatus);
      }
    } catch (error: any) {
      console.error(error);
      setError(error.message || "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const isAutoHidden = report.post?.status === "auto_hidden" && !restored;

  const catLabel = CATEGORY_LABELS[report.category] || report.category;
  const catBadge = CATEGORY_BADGE[report.category]  || "bg-zinc-800 text-zinc-400";
  const isPending = report.status === "pending";

  const screenshotCount = report.screenshot_urls?.length ?? 0;
  const postImages = report.post?.image_urls ?? [];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4 transition hover:border-zinc-700 hover:shadow-sm">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${catBadge}`}>
              {catLabel}
            </span>
            <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-300 capitalize">
              {report.report_type} report
            </span>
            {isAutoHidden && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                Auto-hidden — needs review
              </span>
            )}
          </div>

          {report.description ? (
            <p className="line-clamp-2 text-sm text-zinc-300">{report.description}</p>
          ) : (
            <p className="text-sm italic text-zinc-500">No description provided</p>
          )}

          {report.report_type === "post" && report.post ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-zinc-500">
                {report.post.author_username && (
                  <span className="font-semibold text-zinc-400">@{report.post.author_username}</span>
                )}
                {report.post.community_name && (
                  <>
                    <span>·</span>
                    <span className="rounded-md bg-blue-500/15 px-2 py-0.5 font-medium text-blue-300">{report.post.community_name}</span>
                  </>
                )}
                {screenshotCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-zinc-500">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                        <path fillRule="evenodd" d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm10 5.414-1.293-1.293a1 1 0 00-1.414 0L7 10.414 5.707 9.121a1 1 0 00-1.414 0L3 10.414V12h9v-2.586zM9 7a1 1 0 112 0 1 1 0 01-2 0z" clipRule="evenodd" />
                      </svg>
                      {screenshotCount}
                    </span>
                  </>
                )}
              </div>
              {report.post.body && (
                <p className="mt-1 line-clamp-2 text-zinc-400">{report.post.body}</p>
              )}
              {postImages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {postImages.map((img, idx) => (
                    <a
                      key={idx}
                      href={img}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      <img
                        src={img}
                        alt={`Post image ${idx + 1}`}
                        className="h-20 w-20 rounded-lg border border-zinc-700 object-cover hover:opacity-80 transition"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs">
              <div className="flex items-center gap-2 text-zinc-500">
                {report.reported_user?.username && (
                  <span className="font-semibold text-zinc-400">@{report.reported_user.username}</span>
                )}
                {report.reported_user?.full_name && (
                  <>
                    <span>·</span>
                    <span className="text-zinc-400">{report.reported_user.full_name}</span>
                  </>
                )}
                {screenshotCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-zinc-500">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                        <path fillRule="evenodd" d="M2 4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm10 5.414-1.293-1.293a1 1 0 00-1.414 0L7 10.414 5.707 9.121a1 1 0 00-1.414 0L3 10.414V12h9v-2.586zM9 7a1 1 0 112 0 1 1 0 01-2 0z" clipRule="evenodd" />
                      </svg>
                      {screenshotCount}
                    </span>
                  </>
                )}
              </div>
              {screenshotCount > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.screenshot_urls?.map((img, idx) => (
                    <a
                      key={idx}
                      href={img}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      <img
                        src={img}
                        alt={`Screenshot ${idx + 1}`}
                        className="h-20 w-20 rounded-lg border border-zinc-700 object-cover hover:opacity-80 transition"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <span className="shrink-0 whitespace-nowrap text-xs text-zinc-500">{timeAgo(report.created_at)}</span>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusChip status={report.status} />

        {isPending && onAction && (
          <div className="flex items-center gap-2">
            {isAutoHidden && report.post_id && (
              <button
                onClick={() => handle("restore")}
                disabled={busy !== null}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
              >
                {busy === "restore" ? "Restoring…" : "Restore post"}
              </button>
            )}
            <button
              onClick={() => handle("reviewed")}
              disabled={busy !== null}
              className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:border-blue-500/50 hover:bg-blue-500/20 disabled:opacity-40"
            >
              {busy === "reviewed" ? "Updating…" : "Mark reviewed"}
            </button>
            {(report.report_type === "post" || report.report_type === "profile") && report.reported_user_id && (
              <>
                <button
                  onClick={() => handle("strike")}
                  disabled={busy !== null}
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-40"
                >
                  {busy === "strike" ? "Striking…" : "Strike"}
                </button>
                <button
                  onClick={() => handle("ban")}
                  disabled={busy !== null}
                  className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-40"
                >
                  {busy === "ban" ? "Banning…" : "Ban"}
                </button>
              </>
            )}
            <button
              onClick={() => handle("dismissed")}
              disabled={busy !== null}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
            >
              {busy === "dismissed" ? "Dismissing…" : "Dismiss"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-3 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports list (fetches its own data)
// ---------------------------------------------------------------------------

const MODERATION_PAGE_SIZE = 5;

function ReportsList({
  types,
  statuses,
  actionable = false,
  emptyLabel,
}: {
  types: ("post" | "profile" | "bug")[];
  statuses?: ReportStatus[];
  actionable?: boolean;
  emptyLabel?: string;
}) {
  const [reports, setReports] = useState<EnrichedReport[]>([]);
  const [loading, setLoading]  = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setReports([]);
    setCurrentPage(1);
    fetchReports(types, statuses)
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAction(id: string, status: ReportStatus) {
    await updateReportStatus(id, status);
    if (status === "reviewed" || status === "dismissed") {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <ReportCardSkeleton key={i} />)}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-zinc-700">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="text-sm text-zinc-500">{emptyLabel ?? "Nothing here"}</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(reports.length / MODERATION_PAGE_SIZE));
  const paginatedReports = reports.slice(
    (currentPage - 1) * MODERATION_PAGE_SIZE,
    currentPage * MODERATION_PAGE_SIZE
  );

  return (
    <>
      <div className="space-y-3">
        {paginatedReports.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            onAction={actionable ? handleAction : undefined}
          />
        ))}
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={reports.length}
        pageSize={MODERATION_PAGE_SIZE}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [stats, setStats] = useState<QueueStats | null>(null);

  useEffect(() => {
    fetchQueueStats().then(setStats).catch(console.error);
  }, []);

  const totalPending = stats ? stats.postPending + stats.profilePending : 0;

  const queues = [
    {
      name: "Post reports",
      count: stats?.postPending ?? "—",
      note: stats && stats.postPending > 0 ? "Awaiting review" : "Queue clear",
    },
    {
      name: "Profile reports",
      count: stats?.profilePending ?? "—",
      note: stats && stats.profilePending > 0 ? "Review flagged accounts" : "Queue clear",
    },
    {
      name: "Bug reports",
      count: stats?.bugPending ?? "—",
      note: stats && stats.bugPending > 0 ? "User-submitted bugs" : "No open bugs",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Moderation</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Moderation overview</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Live counts from the database. Review and act on pending reports directly from this queue.
        </p>
      </div>

      {/* Queue stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {!stats
          ? Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
          : queues.map((q) => (
              <div key={q.name} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm transition hover:shadow-md">
                <p className="text-sm font-medium text-zinc-400">{q.name}</p>
                <p className="mt-4 text-3xl font-semibold text-zinc-50">{String(q.count)}</p>
                <p className="mt-2 text-sm text-zinc-400">{q.note}</p>
              </div>
            ))}
      </div>

      {/* Main content */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <Tabs
          tabs={[
            {
              id: "pending",
              label: "Pending review",
              count: stats ? totalPending : undefined,
              color: "amber",
            },
            { id: "reviewed",  label: "Reviewed",     color: "blue"    },
            { id: "dismissed", label: "Dismissed" },
            { id: "bugs",      label: "Bug reports",  count: stats?.bugPending, color: "rose" },
          ]}
          defaultTab="pending"
          variant="underline"
          onChange={setActiveTab}
        />

        <div className="mt-6">
          {activeTab === "pending" && (
            <ReportsList
              types={["post", "profile"]}
              statuses={["pending"]}
              actionable
              emptyLabel="No pending reports — queue is clear"
            />
          )}
          {activeTab === "reviewed" && (
            <ReportsList
              types={["post", "profile"]}
              statuses={["reviewed"]}
              emptyLabel="No reviewed reports yet"
            />
          )}
          {activeTab === "dismissed" && (
            <ReportsList
              types={["post", "profile"]}
              statuses={["dismissed"]}
              emptyLabel="No dismissed reports"
            />
          )}
          {activeTab === "bugs" && (
            <ReportsList
              types={["bug"]}
              actionable
              emptyLabel="No bug reports submitted"
            />
          )}
        </div>
      </div>
    </div>
  );
}
