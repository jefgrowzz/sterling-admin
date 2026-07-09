"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pagination } from "@/components/ui/Pagination";
import type { DiscussionListItem } from "@/app/api/admin/discussions/route";

const PAGE_SIZE = 20;

type PersonLike = { full_name: string | null; username: string | null } | null | undefined;

function personLabel(p: PersonLike): string {
  if (!p) return "Unknown";
  return p.username ? `@${p.username}` : p.full_name ?? "Unknown";
}

function getInitials(p: PersonLike): string {
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

function Avatar({ id, person }: { id: string; person: PersonLike }) {
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarColor(id)}`}>
      {getInitials(person)}
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) {
    return <span className="text-xs text-zinc-600">No ratings</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-zinc-300">
      <span className="text-amber-400">★</span>
      {avg.toFixed(1)}
      <span className="text-xs text-zinc-500">({count})</span>
    </span>
  );
}

function ReportsBadge({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-zinc-600">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
      {count} pending
    </span>
  );
}

const HEADERS = [
  "Title",
  "Location hint",
  "Lat/Lng",
  "Radius (mi)",
  "Rating",
  "Comments",
  "Creator",
  "Created",
  "Reports",
];

function TableSkeleton() {
  return (
    <div className="-mx-6 -mb-6 overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-800/60 text-left text-zinc-400">
          <tr>
            {HEADERS.map((h) => (
              <th key={h} className="px-6 py-4 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              {HEADERS.map((h) => (
                <td key={h} className="px-6 py-4">
                  <div className="h-4 w-20 animate-pulse rounded bg-zinc-700" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "-comment_count", label: "Most comments" },
  { value: "-rate_count", label: "Most ratings" },
  { value: "-avg_rate", label: "Highest rated" },
  { value: "title", label: "Title (A–Z)" },
];

export default function DiscussionsPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sort, setSort] = useState("-created_at");
  const [page, setPage] = useState(1);

  const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort,
    });
    if (search.trim()) params.set("search", search.trim());
    if (city.trim()) params.set("city", city.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (flaggedOnly) params.set("minReports", "1");

    fetch(`/api/admin/discussions?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load discussions");
        setDiscussions(body.discussions);
        setTotal(body.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load discussions"))
      .finally(() => setLoading(false));
  }, [search, city, dateFrom, dateTo, flaggedOnly, sort, page]);

  // Debounced auto-apply for every filter change — no separate "Filter" button to click.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, dateFrom, dateTo, flaggedOnly, sort, page]);

  const hasActiveFilters = !!(search.trim() || city.trim() || dateFrom || dateTo || flaggedOnly);

  function clearFilters() {
    setSearch("");
    setCity("");
    setDateFrom("");
    setDateTo("");
    setFlaggedOnly(false);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Discussions</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Area discussions</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Every location-pinned discussion created in the app. Review, inspect linked reports, and
              remove discussions or individual comments that violate platform rules.
            </p>
          </div>
          <button
            onClick={() => setFlaggedOnly((v) => !v)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              flaggedOnly
                ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40"
                : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
            }`}
          >
            {flaggedOnly ? "● Flagged only" : "Flagged only"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Search title</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="e.g. flooding"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Location hint / city</span>
            <input
              value={city}
              onChange={(e) => { setCity(e.target.value); setPage(1); }}
              placeholder="e.g. Austin"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Sort by</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <span>{loading ? "Filtering…" : `${total} result${total !== 1 ? "s" : ""}`}</span>
            <button onClick={clearFilters} className="text-emerald-400 hover:text-emerald-300">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error}</div>
        ) : discussions.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
            <p>No discussions match these filters</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-emerald-400 hover:text-emerald-300">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="-mx-6 -mb-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-800 text-sm">
              <thead className="bg-zinc-800/60 text-left text-zinc-400">
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h} className="px-6 py-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {discussions.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/dashboard/discussions/${d.id}`)}
                    className="cursor-pointer transition-colors hover:bg-zinc-800/60"
                  >
                    <td className="max-w-xs px-6 py-4">
                      <Link
                        href={`/dashboard/discussions/${d.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="line-clamp-1 font-medium text-zinc-50 hover:text-emerald-300"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{d.location_hint ?? "—"}</td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                      {d.center_lat.toFixed(4)}, {d.center_lng.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{d.radius_miles}</td>
                    <td className="px-6 py-4"><StarRating avg={d.avg_rate} count={d.rate_count} /></td>
                    <td className="px-6 py-4 text-zinc-400">{d.comment_count}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar id={d.creator_id} person={d.creator} />
                        <span className="text-zinc-400">{personLabel(d.creator)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{formatDate(d.created_at)}</td>
                    <td className="px-6 py-4"><ReportsBadge count={d.report_count} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              pageSize={PAGE_SIZE}
            />
          </div>
        )}
      </div>
    </div>
  );
}
