"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProfileStub = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };

type Discussion = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  center_lat: number;
  center_lng: number;
  radius_miles: number;
  location_hint: string | null;
  avg_rate: number | null;
  rate_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  creator: ProfileStub | null;
};

type Comment = {
  id: string;
  discussion_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  likes_count: number;
  created_at: string;
  author: ProfileStub | null;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  report_type: string;
  category: string;
  description: string | null;
  status: string;
  discussion_id: string;
  created_at: string;
  reporter: ProfileStub | null;
};

type Ratings = { avg_rate: number | null; rate_count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };

type ReverseGeocodedAddress = {
  display_name: string;
  road: string | null;
  house_number: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
};

type DetailResponse = {
  discussion: Discussion;
  comments: Comment[];
  ratings: Ratings;
  reports: ReportRow[];
  address: ReverseGeocodedAddress | null;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function creatorLabel(p: ProfileStub | null): string {
  if (!p) return "Unknown user";
  return p.username ? `@${p.username}` : p.full_name ?? "Unknown user";
}

function getInitials(p: ProfileStub | null): string {
  if (p?.full_name?.trim()) {
    const parts = p.full_name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return p.full_name.slice(0, 2).toUpperCase();
  }
  return (p?.username ?? "??").slice(0, 2).toUpperCase();
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

function Avatar({ id, person, size = "sm" }: { id: string; person: ProfileStub | null; size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-11 w-11 text-sm" : "h-8 w-8 text-xs";
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dims} ${avatarColor(id)}`}>
      {getInitials(person)}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-800/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function LocationCard({ discussion, address }: { discussion: Discussion; address: ReverseGeocodedAddress | null }) {
  const { center_lat: lat, center_lng: lng } = discussion;
  const pad = 0.01;
  const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`;
  const osmEmbedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlng=${lng}#map=16/${lat}/${lng}`;
  const googleMapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

  const streetLine = [address?.house_number, address?.road].filter(Boolean).join(" ");
  const cityStateLine = [address?.city, address?.state, address?.postcode].filter(Boolean).join(", ");

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Location</h3>
      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <iframe
          title="Discussion location map"
          src={osmEmbedSrc}
          className="h-64 w-full"
          style={{ border: 0 }}
          loading="lazy"
        />
      </div>

      <div className="mt-4 space-y-1 text-sm">
        {address ? (
          <>
            {streetLine && <p className="text-zinc-200">{streetLine}</p>}
            {cityStateLine && <p className="text-zinc-400">{cityStateLine}</p>}
            {address.country && <p className="text-zinc-500">{address.country}</p>}
            <p className="mt-1.5 text-[11px] text-zinc-600">
              Approximate — looked up from coordinates, not stored data
            </p>
          </>
        ) : (
          <p className="text-zinc-500">Address lookup unavailable</p>
        )}
        <p className="font-mono text-xs text-zinc-500">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <a
          href={googleMapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-zinc-800 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Open in Google Maps
        </a>
        <a
          href={osmLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-zinc-800 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Open in OpenStreetMap
        </a>
      </div>
    </div>
  );
}

const REPORT_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  reviewed: "bg-blue-500/15 text-blue-300",
  resolved: "bg-emerald-500/15 text-emerald-300",
  dismissed: "bg-zinc-800 text-zinc-400",
};

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="h-4 w-24 rounded bg-zinc-700" />
        <div className="mt-3 h-7 w-64 rounded bg-zinc-700" />
        <div className="mt-4 h-4 w-full max-w-md rounded bg-zinc-700" />
      </div>
      <div className="animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="h-40 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export default function DiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [banning, setBanning] = useState(false);
  const [deletingDiscussion, setDeletingDiscussion] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/discussions/${id}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load discussion");
        setData(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load discussion"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDeleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    setDeletingCommentId(commentId);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/discussions/${id}/comments/${commentId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to delete comment");
      setData((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments.filter((c) => c.id !== commentId),
              discussion: { ...prev.discussion, comment_count: Math.max(0, prev.discussion.comment_count - 1) },
            }
          : prev
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleUpdateReportStatus(reportId: string, status: string) {
    setUpdatingReportId(reportId);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update report");
      setData((prev) =>
        prev ? { ...prev, reports: prev.reports.map((r) => (r.id === reportId ? { ...r, status } : r)) } : prev
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setUpdatingReportId(null);
    }
  }

  async function handleBanCreator() {
    if (!data || !confirm(`Ban ${creatorLabel(data.discussion.creator)}? This also bans their devices.`)) return;
    setBanning(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${data.discussion.creator_id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `Banned from discussion review (discussion: ${id})` }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to ban user");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to ban user");
    } finally {
      setBanning(false);
    }
  }

  async function handleDeleteDiscussion() {
    if (!confirm("Delete this discussion? This also deletes all its comments and ratings.")) return;
    setDeletingDiscussion(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/discussions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolveReports: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to delete discussion");
      router.push("/dashboard/discussions");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete discussion");
      setDeletingDiscussion(false);
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error ?? "Discussion not found"}</div>
        <Link href="/dashboard/discussions" className="mt-4 inline-block text-sm text-zinc-400 hover:text-zinc-200">
          ← Back to discussions
        </Link>
      </div>
    );
  }

  const { discussion, comments, ratings, reports, address } = data;
  const pendingReports = reports.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <Link href="/dashboard/discussions" className="inline-block text-sm text-zinc-500 hover:text-zinc-300">
        ← Back to discussions
      </Link>

      {/* Header */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Discussion</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{discussion.title}</h2>
            {discussion.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{discussion.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Avatar id={discussion.creator_id} person={discussion.creator} />
              <div>
                <p className="text-sm font-medium text-zinc-300">{creatorLabel(discussion.creator)}</p>
                <p className="text-xs text-zinc-500">Created {formatDate(discussion.created_at)}</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleBanCreator}
              disabled={banning}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-40"
            >
              {banning ? "Banning…" : "Ban creator"}
            </button>
            <button
              onClick={handleDeleteDiscussion}
              disabled={deletingDiscussion}
              className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-40"
            >
              {deletingDiscussion ? "Deleting…" : "Delete discussion"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip label="Location" value={discussion.location_hint ?? "—"} />
          <StatChip label="Radius" value={`${discussion.radius_miles} mi`} />
          <StatChip label="Comments" value={String(discussion.comment_count)} />
          <StatChip label="Rating" value={discussion.rate_count > 0 ? `★ ${discussion.avg_rate?.toFixed(1)} (${discussion.rate_count})` : "No ratings"} />
        </div>

        {pendingReports.length > 0 && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            {pendingReports.length} pending report{pendingReports.length !== 1 ? "s" : ""}
          </div>
        )}

        {actionError && (
          <div className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{actionError}</div>
        )}
      </div>

      <LocationCard discussion={discussion} address={address} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ratings */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Ratings</h3>
          {ratings.rate_count === 0 ? (
            <p className="text-sm text-zinc-500">No ratings yet</p>
          ) : (
            <>
              <p className="text-3xl font-semibold text-zinc-50">
                {ratings.avg_rate?.toFixed(1)} <span className="text-base font-normal text-amber-400">★</span>
              </p>
              <p className="mt-1 text-sm text-zinc-500">{ratings.rate_count} rating{ratings.rate_count !== 1 ? "s" : ""}</p>
              <div className="mt-4 space-y-1.5">
                {([5, 4, 3, 2, 1] as const).map((star) => {
                  const count = ratings.distribution[star];
                  const pct = ratings.rate_count ? (count / ratings.rate_count) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="w-3">{star}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Linked reports */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Linked reports</h3>
          {reports.length === 0 ? (
            <p className="text-sm text-zinc-500">No reports filed against this discussion</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-800/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <Avatar id={r.reporter_id} person={r.reporter} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold capitalize text-zinc-300">{r.category.replace(/_/g, " ")}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${REPORT_STATUS_BADGE[r.status] ?? "bg-zinc-800 text-zinc-400"}`}>
                            {r.status}
                          </span>
                        </div>
                        {r.description && <p className="mt-1 text-sm text-zinc-400">{r.description}</p>}
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Reported by {creatorLabel(r.reporter)} · {formatDate(r.created_at)}
                        </p>
                      </div>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => handleUpdateReportStatus(r.id, "reviewed")}
                          disabled={updatingReportId === r.id}
                          className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-300 transition hover:border-blue-500/50 hover:bg-blue-500/20 disabled:opacity-40"
                        >
                          Reviewed
                        </button>
                        <button
                          onClick={() => handleUpdateReportStatus(r.id, "resolved")}
                          disabled={updatingReportId === r.id}
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleUpdateReportStatus(r.id, "dismissed")}
                          disabled={updatingReportId === r.id}
                          className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Comments ({comments.length})
        </h3>
        {comments.length === 0 ? (
          <p className="text-sm text-zinc-500">No comments yet</p>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className={c.parent_id ? "ml-8 border-l-2 border-zinc-800 pl-4" : ""}>
                <div className="rounded-xl border border-zinc-800 bg-zinc-800/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <Avatar id={c.author_id} person={c.author} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-300">{creatorLabel(c.author)}</span>
                          {c.parent_id && (
                            <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400">reply</span>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-400">{c.body}</p>
                        <p className="mt-1.5 text-[11px] text-zinc-500">
                          {formatDate(c.created_at)} · {c.likes_count} like{c.likes_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      disabled={deletingCommentId === c.id}
                      className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      {deletingCommentId === c.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
