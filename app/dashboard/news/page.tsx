"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchMarkets,
  fetchOverride,
  fetchCandidates,
  saveOverride,
  clearOverride,
  type Market,
  type NewsOverride,
  type NewsCandidate,
} from "./actions";
import { getTomorrowUtcDate } from "./date";

function marketKey(m: Market): string {
  return `${m.city}|${m.state ?? ""}`;
}

function marketLabel(m: Market): string {
  return m.state ? `${m.city}, ${m.state}` : m.city;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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
  dateUtc,
  onManage,
}: {
  market: Market;
  dateUtc: string;
  onManage: () => void;
}) {
  const [override, setOverride] = useState<NewsOverride | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOverride(undefined);
    fetchOverride({ city: market.city, state: market.state, dateUtc })
      .then((result) => { if (!cancelled) setOverride(result); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load"); });
    return () => { cancelled = true; };
  }, [market.city, market.state, dateUtc]);

  const loading = override === undefined;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4 transition hover:border-zinc-700">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="font-semibold text-zinc-50">{marketLabel(market)}</p>
            <span className="text-[11px] text-zinc-500">
              {market.requestCount} request{market.requestCount !== 1 ? "s" : ""} · last {timeAgo(market.lastRequestedAt)}
            </span>
          </div>
          {loading ? (
            <div className="mt-1.5 h-3 w-56 animate-pulse rounded bg-zinc-700" />
          ) : error ? (
            <p className="mt-1 text-xs text-rose-400">{error}</p>
          ) : override ? (
            <p className="mt-1 line-clamp-1 text-sm text-zinc-400">{override.title}</p>
          ) : (
            <p className="mt-1 text-sm italic text-zinc-500">No override — using auto selection</p>
          )}
        </div>
        {!loading && !error && <OverrideBadge hasOverride={!!override} />}
        <button
          onClick={onManage}
          className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Manage
        </button>
      </div>
    </div>
  );
}

function CandidateCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4">
      <div className="flex gap-4">
        <div className="h-16 w-16 shrink-0 rounded-xl bg-zinc-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-zinc-700" />
          <div className="h-3 w-full rounded bg-zinc-700" />
          <div className="h-3 w-1/3 rounded bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: NewsCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
          : "border-zinc-800 bg-zinc-800/60 hover:border-zinc-700"
      }`}
    >
      <div className="flex gap-4">
        {candidate.image_url ? (
          <img
            src={candidate.image_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl border border-zinc-700 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12h-9M12 6.75h-1.5m1.5 3h-1.5" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold text-zinc-50">{candidate.title}</p>
            {selected && (
              <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                Selected
              </span>
            )}
          </div>
          {candidate.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{candidate.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-500">
            {candidate.source && <span>{candidate.source}</span>}
            {candidate.published_at && (
              <>
                <span>·</span>
                <span>{new Date(candidate.published_at).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Manage panel (slide-over) — view/save/clear the override for one market+date
// ---------------------------------------------------------------------------

function ManagePanel({
  market,
  dateUtc,
  onClose,
  onChanged,
}: {
  market: Market;
  dateUtc: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [override, setOverride] = useState<NewsOverride | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<NewsCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NewsCandidate | null>(null);

  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadOverride = useCallback(() => {
    setOverrideLoading(true);
    setError(null);
    fetchOverride({ city: market.city, state: market.state, dateUtc })
      .then(setOverride)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load override"))
      .finally(() => setOverrideLoading(false));
  }, [market.city, market.state, dateUtc]);

  useEffect(() => {
    loadOverride();
  }, [loadOverride]);

  async function handleFetchCandidates() {
    setCandidatesLoading(true);
    setCandidatesError(null);
    setCandidates([]);
    setSelected(null);
    try {
      const result = await fetchCandidates({ city: market.city, state: market.state });
      setCandidates(result);
    } catch (err) {
      setCandidatesError(err instanceof Error ? err.message : "Failed to fetch candidate stories");
    } finally {
      setCandidatesLoading(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveOverride({
        dateUtc,
        city: market.city,
        state: market.state,
        candidate: selected,
        reason,
      });
      setOverride(result);
      setSelected(null);
      setCandidates([]);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save override");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    setError(null);
    try {
      await clearOverride({ dateUtc, city: market.city, state: market.state });
      setOverride(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear override");
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-hidden bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">{marketLabel(market)}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">{formatDate(dateUtc)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Current story</h3>
            {!overrideLoading && <OverrideBadge hasOverride={!!override} />}
          </div>

          {overrideLoading ? (
            <CandidateCardSkeleton />
          ) : override ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex gap-4">
                {override.image_url ? (
                  <img src={override.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-zinc-700 object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-50">{override.title}</p>
                  {override.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{override.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-500">
                    {override.source && <span>{override.source}</span>}
                    {override.reason && (
                      <>
                        <span>·</span>
                        <span>Reason: {override.reason}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className="h-fit shrink-0 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-40"
                >
                  {clearing ? "Clearing…" : "Clear override"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
              No override set — mobile app is using auto-selected news
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Candidate stories</h3>
            <button
              onClick={handleFetchCandidates}
              disabled={candidatesLoading}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
            >
              {candidatesLoading ? "Fetching…" : "Fetch candidates"}
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {candidatesLoading ? (
              Array.from({ length: 3 }).map((_, i) => <CandidateCardSkeleton key={i} />)
            ) : candidatesError ? (
              <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{candidatesError}</div>
            ) : candidates.length === 0 ? (
              <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No candidates fetched yet
              </div>
            ) : (
              candidates.map((c, i) => (
                <CandidateCard
                  key={c.article_id ?? c.article_url ?? i}
                  candidate={c}
                  selected={selected?.article_url === c.article_url}
                  onSelect={() => setSelected(c)}
                />
              ))
            )}
          </div>

          {selected && (
            <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-zinc-400">Reason (optional)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why override the auto selection?"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
                />
              </label>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save as override"}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error}</div>
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
// Add market
// ---------------------------------------------------------------------------

function AddMarketForm({ onAdd, onCancel }: { onAdd: (market: Pick<Market, "city" | "state">) => void; onCancel: () => void }) {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4">
      <p className="mb-3 text-xs text-zinc-500">
        Markets normally appear here on their own once the app requests news for them. Only add one
        manually if you need to set an override before real traffic arrives.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          autoFocus
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
        />
        <input
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="State (optional)"
          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
        />
        <button
          onClick={() => city.trim() && onAdd({ city: city.trim(), state: state.trim() || null })}
          disabled={!city.trim()}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewsPage() {
  const [dateUtc, setDateUtc] = useState(getTomorrowUtcDate());
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingMarket, setAddingMarket] = useState(false);
  const [managing, setManaging] = useState<Market | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchMarkets()
      .then(setMarkets)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load markets"))
      .finally(() => setLoading(false));
  }, []);

  function handleAddMarket(seed: Pick<Market, "city" | "state">) {
    const market: Market = { ...seed, requestCount: 0, lastRequestedAt: new Date().toISOString() };
    setMarkets((prev) => {
      const key = marketKey(market);
      if (prev.some((m) => marketKey(m) === key)) return prev;
      return [market, ...prev];
    });
    setAddingMarket(false);
    setManaging(market);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">News</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">News of the Day</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Every market the app has requested news for, with the story currently going out on the
          selected date. Markets appear here automatically from real traffic. The mobile app checks
          for a manual override first and falls back to auto-selection when none is set.
        </p>

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
            onClick={() => setDateUtc(getTomorrowUtcDate())}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Preview tomorrow (UTC)
          </button>
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
          ) : markets.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
              <p>No markets requested yet</p>
              <p className="text-xs">Markets show up here as soon as the app requests news for them</p>
            </div>
          ) : (
            markets.map((market) => (
              <MarketRow
                key={`${marketKey(market)}-${refreshKey}`}
                market={market}
                dateUtc={dateUtc}
                onManage={() => setManaging(market)}
              />
            ))
          )}
        </div>
      </div>

      {managing && (
        <ManagePanel
          market={managing}
          dateUtc={dateUtc}
          onClose={() => setManaging(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
