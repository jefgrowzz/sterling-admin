"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  fetchMarkets,
  fetchOverridesForDate,
  fetchResolvedNews,
  fetchCandidates,
  fetchFullArticlePreview,
  saveOverride,
  clearOverride,
  addMarket,
  deleteMarket,
  type Market,
  type NewsOverride,
  type NewsCandidate,
  type NewsSelectionSource,
} from "./actions";
import { marketLabel } from "./state-labels";
import { getTodayUtcDate, getTomorrowUtcDate } from "./date";
import { AppNewsPreview } from "./AppNewsPreview";

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
          className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Manage
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
  isCurrent,
  onSelect,
}: {
  candidate: NewsCandidate;
  selected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
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
            <div className="flex shrink-0 gap-1">
              {isCurrent && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                  Current
                </span>
              )}
              {selected && !isCurrent && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                  Selected
                </span>
              )}
            </div>
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

function toPreviewStory(
  row: {
    title: string;
    description: string | null;
    source?: string | null;
    image_url?: string | null;
    article_url?: string | null;
    published_at?: string | null;
  },
): Parameters<typeof AppNewsPreview>[0]["story"] {
  return {
    title: row.title,
    description: row.description,
    source: row.source,
    image_url: row.image_url,
    article_url: row.article_url ?? null,
    published_at: row.published_at,
  };
}

function toEditableCandidate(story: {
  article_id?: string | null;
  article_url?: string | null;
  title?: string | null;
  description?: string | null;
  content?: string | null;
  source?: string | null;
  image_url?: string | null;
  published_at?: string | null;
} | null): NewsCandidate | null {
  if (!story?.title?.trim()) return null;
  const articleUrl = (story.article_url ?? story.article_id ?? "").trim();
  if (!articleUrl) return null;
  return {
    article_id: story.article_id ?? articleUrl,
    article_url: articleUrl,
    title: story.title.trim(),
    description: story.description ?? null,
    content: story.content ?? null,
    source: story.source ?? null,
    image_url: story.image_url ?? null,
    published_at: story.published_at ?? null,
  };
}

function StoryEditorForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  isOverride,
  stateLabel,
  reason,
  onReasonChange,
}: {
  draft: NewsCandidate;
  onChange: (next: NewsCandidate) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isOverride: boolean;
  stateLabel: string;
  reason: string;
  onReasonChange: (value: string) => void;
}) {
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  async function handleLoadFullContent() {
    if (!draft.article_url) return;
    setContentLoading(true);
    setContentError(null);
    try {
      const result = await fetchFullArticlePreview({
        url: draft.article_url,
        title: draft.title,
      });
      if (result.error || !result.text) {
        setContentError(result.error ?? "Could not load full article text");
        return;
      }
      onChange({ ...draft, content: result.text });
    } catch (err) {
      setContentError(err instanceof Error ? err.message : "Failed to load full article");
    } finally {
      setContentLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
          {isOverride ? "Edit story" : "Override auto selection"}
        </h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draft.title.trim() || !draft.article_url}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {saving ? "Saving…" : isOverride ? "Save changes" : "Save as override"}
          </button>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-400">Title</span>
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-400">Description (map card preview)</span>
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => onChange({ ...draft, description: e.target.value || null })}
          rows={3}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-emerald-500/50"
        />
      </label>

      <div className="block">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-400">Full article body (news page)</span>
          <button
            type="button"
            onClick={handleLoadFullContent}
            disabled={contentLoading || !draft.article_url}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
          >
            {contentLoading ? "Loading…" : "Load from URL"}
          </button>
        </div>
        <textarea
          value={draft.content ?? ""}
          onChange={(e) => onChange({ ...draft, content: e.target.value || null })}
          rows={8}
          placeholder="Paste or load the full article text shown in the app news page…"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
        />
        {contentError ? <p className="mt-1.5 text-xs text-rose-400">{contentError}</p> : null}
      </div>

      {draft.article_url ? (
        <p className="text-[11px] text-zinc-500 break-all">
          Source URL:{" "}
          <a href={draft.article_url} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-200">
            {draft.article_url}
          </a>
        </p>
      ) : null}

      <AppNewsPreview story={toPreviewStory(draft)} stateLabel={stateLabel} compact />

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-400">Reason (optional)</span>
        <input
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Why override the auto selection?"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manage panel (slide-over) — view/save/clear the override for one market+date
// ---------------------------------------------------------------------------

function ManagePanel({
  market,
  dateUtc,
  initialOverride,
  onClose,
  onChanged,
}: {
  market: Market;
  dateUtc: string;
  initialOverride: NewsOverride | null;
  onClose: () => void;
  onChanged: (override: NewsOverride | null, message: string) => void;
}) {
  const [override, setOverride] = useState<NewsOverride | null>(initialOverride);
  const panelScrollRef = useRef<HTMLDivElement>(null);

  const [candidates, setCandidates] = useState<NewsCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewsCandidate | null>(null);

  const [livePreview, setLivePreview] = useState<NewsCandidate | null>(null);
  const [livePreviewLoading, setLivePreviewLoading] = useState(true);
  const [selectionSource, setSelectionSource] = useState<NewsSelectionSource>("none");

  const effectiveStory = override
    ? {
        title: override.title,
        description: override.description,
        source: override.source,
        image_url: override.image_url,
        article_url: override.article_url,
        published_at: override.published_at,
      }
    : livePreview;

  function scrollPanelToTop() {
    panelScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function beginEditing(story: Parameters<typeof toEditableCandidate>[0]) {
    const editable = toEditableCandidate(story);
    if (!editable) {
      setError("This story is missing a title or URL and cannot be edited.");
      return;
    }
    setDraft(editable);
    setError(null);
    requestAnimationFrame(() => scrollPanelToTop());
  }

  function cancelEditing() {
    setDraft(null);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    setLivePreviewLoading(true);
    setCandidatesLoading(true);
    setCandidatesError(null);

    fetchResolvedNews({ state: market.state, dateUtc })
      .then(async (resolved) => {
        if (cancelled) return;
        if (!override) {
          setLivePreview(resolved.selectedArticle);
          setSelectionSource(resolved.selectionSource);
        }
        if (resolved.candidates.length > 0) {
          setCandidates(resolved.candidates);
          return;
        }
        const fresh = await fetchCandidates({ state: market.state, dateUtc });
        if (!cancelled) setCandidates(fresh);
      })
      .catch((err) => {
        if (!cancelled) {
          setCandidatesError(err instanceof Error ? err.message : "Failed to load live story");
          setLivePreview(null);
          setSelectionSource("none");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLivePreviewLoading(false);
          setCandidatesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override, market.state, dateUtc]);

  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetchCandidates() {
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const result = await fetchCandidates({ state: market.state, dateUtc });
      setCandidates(result);
    } catch (err) {
      setCandidatesError(err instanceof Error ? err.message : "Failed to fetch candidate stories");
    } finally {
      setCandidatesLoading(false);
    }
  }

  function handleEditCurrentStory() {
    beginEditing(
      override
        ? {
            article_id: override.article_id,
            article_url: override.article_url,
            title: override.title,
            description: override.description,
            content: override.content,
            source: override.source,
            image_url: override.image_url,
            published_at: override.published_at,
          }
        : livePreview,
    );
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveOverride({
        dateUtc,
        state: market.state,
        candidate: draft,
        reason,
      });
      setOverride(result);
      setDraft(null);
      setReason("");
      setSelectionSource("override");
      onChanged(result, `Saved override for ${marketLabel(market.state)}`);
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
      await clearOverride({ dateUtc, state: market.state });
      setOverride(null);
      onChanged(null, `Cleared override for ${marketLabel(market.state)} — back to auto selection`);
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
            <h2 className="text-base font-semibold text-zinc-50">{marketLabel(market.state)}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">{formatDate(dateUtc)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div ref={panelScrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Current story</h3>
            <OverrideBadge hasOverride={!!override} />
          </div>

          {draft ? (
            <StoryEditorForm
              draft={draft}
              onChange={setDraft}
              onSave={handleSave}
              onCancel={cancelEditing}
              saving={saving}
              isOverride={!!override}
              stateLabel={marketLabel(market.state)}
              reason={reason}
              onReasonChange={setReason}
            />
          ) : override ? (
            <div className="space-y-4">
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
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleEditCurrentStory}
                      className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
                    >
                      Edit story
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      disabled={clearing}
                      className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      {clearing ? "Clearing…" : "Clear override"}
                    </button>
                  </div>
                </div>
              </div>
              <AppNewsPreview
                story={toPreviewStory({
                  title: override.title,
                  description: override.description,
                  source: override.source,
                  image_url: override.image_url,
                  article_url: override.article_url,
                  published_at: override.published_at,
                })}
                stateLabel={marketLabel(market.state)}
              />
            </div>
          ) : livePreviewLoading ? (
            <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
              Loading live story…
            </div>
          ) : livePreview ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-700 bg-zinc-800/60 p-4">
                <div className="flex gap-4">
                  {livePreview.image_url ? (
                    <img src={livePreview.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-zinc-700 object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-50">{livePreview.title}</p>
                    {livePreview.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{livePreview.description}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-500">
                      {livePreview.source && <span>{livePreview.source}</span>}
                      <span>·</span>
                      <span>
                        {selectionSource === "auto"
                          ? "Auto-selected — same story the mobile app serves"
                          : "Live story for this date"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleEditCurrentStory}
                    className="h-fit shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20"
                  >
                    Edit / override
                  </button>
                </div>
              </div>
              <AppNewsPreview story={toPreviewStory(livePreview)} stateLabel={marketLabel(market.state)} />
            </div>
          ) : (
            <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
              No story resolved for this state and date yet
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Candidate stories</h3>
            <button
              type="button"
              onClick={handleFetchCandidates}
              disabled={candidatesLoading}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
            >
              {candidatesLoading ? "Fetching…" : "Refresh candidates"}
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {candidatesLoading ? (
              Array.from({ length: 3 }).map((_, i) => <CandidateCardSkeleton key={i} />)
            ) : candidatesError ? (
              <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{candidatesError}</div>
            ) : candidates.length === 0 ? (
              <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No candidate stories available — try refreshing
              </div>
            ) : (
              candidates.map((c, i) => (
                <CandidateCard
                  key={c.article_id ?? c.article_url ?? i}
                  candidate={c}
                  selected={draft?.article_url === c.article_url}
                  isCurrent={!!effectiveStory?.article_url && effectiveStory.article_url === c.article_url}
                  onSelect={() => beginEditing(c)}
                />
              ))
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error}</div>
          )}
        </div>

        <div className="border-t border-zinc-800 px-6 py-4">
          <button type="button" onClick={onClose} className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800">
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
          selected date. Auto-selected stories use the same resolver as the mobile app — open
          Manage to preview, edit, or override them.
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
        <ManagePanel
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
