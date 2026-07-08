"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Pagination } from "@/components/ui/Pagination";
import type { DiscussionListItem } from "@/app/api/admin/discussions/route";

const PAGE_SIZE = 20;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) {
    return <span className="text-xs text-zinc-500">No ratings</span>;
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

export default function DiscussionsPage() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minReports, setMinReports] = useState(0);
  const [page, setPage] = useState(1);

  const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort: "-created_at",
    });
    if (search.trim()) params.set("search", search.trim());
    if (city.trim()) params.set("city", city.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (minReports > 0) params.set("minReports", String(minReports));

    fetch(`/api/admin/discussions?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load discussions");
        setDiscussions(body.discussions);
        setTotal(body.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load discussions"))
      .finally(() => setLoading(false));
  }, [search, city, dateFrom, dateTo, minReports, page]);

  useEffect(() => { load(); }, [load]);

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Discussions</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Area discussions</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Every location-pinned discussion created in the app. Review, inspect linked reports, and
          remove discussions or individual comments that violate platform rules.
        </p>

        <form onSubmit={handleFilterSubmit} className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Search title</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. flooding"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Location hint / city</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Austin"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Min. pending reports</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={minReports}
                onChange={(e) => setMinReports(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
              >
                Filter
              </button>
            </div>
          </label>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error}</div>
        ) : discussions.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
            No discussions match these filters
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
                  <tr key={d.id} className="transition-colors hover:bg-zinc-800/60">
                    <td className="max-w-xs px-6 py-4">
                      <Link href={`/dashboard/discussions/${d.id}`} className="line-clamp-1 font-medium text-zinc-50 hover:text-emerald-300">
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
                    <td className="px-6 py-4 text-zinc-400">
                      {d.creator?.username ? `@${d.creator.username}` : d.creator?.full_name ?? "Unknown"}
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
