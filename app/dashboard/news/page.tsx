"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchMarkets,
  fetchOverridesForDate,
  fetchResolvedNews,
  addMarket,
  deleteMarket,
  type Market,
  type NewsOverride,
  type NewsCandidate,
} from "./actions";
import { marketLabel } from "./state-labels";
import { getTodayUtcDate, getTomorrowUtcDate } from "./date";
import { NewsWorkspace } from "./NewsWorkspace";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function marketKey(m: { state: string | null }): string {
  return norm(m.state);
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}


function OverrideBadge({ hasOverride }: { hasOverride: boolean }) {
  return hasOverride ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Manual Override
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      Auto
    </span>
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

function MarketRowSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-zinc-700" />
          <div className="h-3 w-64 rounded bg-zinc-700" />
        </div>
        <div className="h-6 w-24 rounded-full bg-zinc-700" />
        <div className="h-8 w-20 rounded-full bg-zinc-700" />
      </div>
    </div>
  );
}

function MarketRow({
  market,
  override,
  dateUtc,
  onManage,
  onDelete,
  deleting,
}: {
  market: Market;
  override: NewsOverride | null;
  dateUtc: string;
  onManage: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const hasOverride = !!override;
  const [autoPreview, setAutoPreview] = useState<NewsCandidate | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState(false);

  useEffect(() => {
    if (hasOverride) return;
    let cancelled = false;
    setAutoLoading(true);
    setAutoError(false);
    fetchResolvedNews({ state: market.state, dateUtc })
      .then((resolved) => {
        if (!cancelled) setAutoPreview(resolved.selectedArticle);
      })
      .catch(() => {
        if (!cancelled) setAutoError(true);
      })
      .finally(() => {
        if (!cancelled) setAutoLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOverride, market.state, dateUtc]);

  return (
    <div
      className={`rounded-2xl border-l-4 bg-zinc-800/60 p-4 transition hover:border-l-zinc-600 ${
        hasOverride ? "border-l-emerald-500" : "border-l-zinc-700"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="font-semibold text-zinc-50">{marketLabel(market.state)}</p>
            <span className="text-[11px] text-zinc-500">
              {market.requestCount} request{market.requestCount !== 1 ? "s" : ""} · last {timeAgo(market.lastRequestedAt)}
            </span>
          </div>
          {override ? (
            <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{override.title}</p>
          ) : autoLoading ? (
            <p className="mt-1 text-sm italic text-zinc-500">Loading live story…</p>
          ) : autoError ? (
            <p className="mt-1 text-sm italic text-rose-400">Couldn't load live story</p>
          ) : autoPreview ? (
            <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{autoPreview.title}</p>
          ) : (
            <p className="mt-1 text-sm italic text-zinc-500">No story resolved yet for this date</p>
          )}
        </div>
        <OverrideBadge hasOverride={hasOverride} />
        <button
          onClick={onManage}
          className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20"
        >
          Open editor
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Remove market"
          className="shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Removing…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add market
// ---------------------------------------------------------------------------

function AddMarketForm({ onAdd, onCancel }: { onAdd: (state: string) => Promise<void>; onCancel: () => void }) {
  const [state, setState] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!state.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(state.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add state");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4">
      <p className="mb-3 text-xs text-zinc-500">
        States normally appear here on their own once the app requests news for them. Only add one
        manually if you need to set an override before real traffic arrives.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="State (e.g. FL or Florida)"
          autoFocus
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!state.trim() || submitting}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          {submitting ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewsPage() {
  const [dateUtc, setDateUtc] = useState(getTodayUtcDate());
  const [markets, setMarkets] = useState<Market[]>([]);
  const [overrides, setOverrides] = useState<NewsOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addingMarket, setAddingMarket] = useState(false);
  const [managing, setManaging] = useState<Market | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchMarkets(), fetchOverridesForDate(dateUtc)])
      .then(([m, o]) => { setMarkets(m); setOverrides(o); })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load markets"))
      .finally(() => setLoading(false));
  }, [dateUtc]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const overrideByMarket = useMemo(() => {
    const map = new Map<string, NewsOverride>();
    for (const o of overrides) {
      const key = marketKey({ state: o.state });
      // overrides is sorted updated_at desc, so the first hit per key is the latest.
      if (!map.has(key)) map.set(key, o);
    }
    return map;
  }, [overrides]);

  const filteredMarkets = useMemo(() => {
    const term = norm(search);
    if (!term) return markets;
    return markets.filter((m) => norm(marketLabel(m.state)).includes(term) || norm(m.state).includes(term));
  }, [markets, search]);

  const overriddenCount = markets.filter((m) => overrideByMarket.has(marketKey(m))).length;

  async function handleAddMarket(state: string) {
    const market = await addMarket({ state });
    setMarkets((prev) => {
      const key = marketKey(market);
      if (prev.some((m) => marketKey(m) === key)) return prev;
      return [market, ...prev];
    });
    setAddingMarket(false);
    setManaging(market);
  }

  async function handleDeleteMarket(market: Market) {
    if (!confirm(`Remove ${marketLabel(market.state)} from the states list? This also deletes any saved override for it.`)) return;
    const key = marketKey(market);
    setDeletingKey(key);
    try {
      await deleteMarket({ state: market.state });
      setMarkets((prev) => prev.filter((m) => marketKey(m) !== key));
      setOverrides((prev) => prev.filter((o) => marketKey({ state: o.state }) !== key));
      if (managing && marketKey(managing) === key) setManaging(null);
      setToast(`Removed ${marketLabel(market.state)}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to remove market");
    } finally {
      setDeletingKey(null);
    }
  }

  function handleOverrideChanged(market: Market, override: NewsOverride | null, message: string) {
    setOverrides((prev) => {
      const key = marketKey(market);
      const withoutThis = prev.filter((o) => marketKey({ state: o.state }) !== key);
      return override ? [override, ...withoutThis] : withoutThis;
    });
    setToast(message);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">News</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">News of the Day</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Every state the app has requested news for, with the story currently going out on the
          selected date. Use Open editor for a full-screen workspace to preview, edit, or override
          each state&apos;s story.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-5 sm:max-w-md">
          <StatChip label="Markets" value={loading ? "—" : String(markets.length)} />
          <StatChip label="Overridden" value={loading ? "—" : String(overriddenCount)} />
          <StatChip label="Auto" value={loading ? "—" : String(markets.length - overriddenCount)} />
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-zinc-800 pt-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Date (UTC)</span>
            <input
              type="date"
              value={dateUtc}
              onChange={(e) => setDateUtc(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
            />
          </label>
          <button
            onClick={() => setDateUtc(getTodayUtcDate())}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Today (UTC)
          </button>
          <button
            onClick={() => setDateUtc(getTomorrowUtcDate())}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Preview tomorrow (UTC)
          </button>
          <label className="block flex-1 min-w-[180px]">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Search markets</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by state"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </label>
          <div className="ml-auto">
            <button
              onClick={() => setAddingMarket(true)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
            >
              + Add market manually
            </button>
          </div>
        </div>
      </div>

      {/* Markets list */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="space-y-3">
          {addingMarket && (
            <AddMarketForm onAdd={handleAddMarket} onCancel={() => setAddingMarket(false)} />
          )}

          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <MarketRowSkeleton key={i} />)
          ) : error ? (
            <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error}</div>
          ) : filteredMarkets.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
              {markets.length === 0 ? (
                <>
                  <p>No markets requested yet</p>
                  <p className="text-xs">Markets show up here as soon as the app requests news for them</p>
                </>
              ) : (
                <p>No markets match "{search}"</p>
              )}
            </div>
          ) : (
            filteredMarkets.map((market) => (
              <MarketRow
                key={marketKey(market)}
                market={market}
                override={overrideByMarket.get(marketKey(market)) ?? null}
                dateUtc={dateUtc}
                onManage={() => setManaging(market)}
                onDelete={() => handleDeleteMarket(market)}
                deleting={deletingKey === marketKey(market)}
              />
            ))
          )}
        </div>
      </div>

      {managing && (
        <NewsWorkspace
          market={managing}
          dateUtc={dateUtc}
          initialOverride={overrideByMarket.get(marketKey(managing)) ?? null}
          onClose={() => setManaging(null)}
          onChanged={(override, message) => handleOverrideChanged(managing, override, message)}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300 shadow-lg ring-1 ring-emerald-500/30">
          {toast}
        </div>
      )}
    </div>
  );
}
