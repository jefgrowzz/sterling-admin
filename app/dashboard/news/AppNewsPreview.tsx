"use client";

import { useMemo, useState } from "react";
import { getAppMapCardPreview } from "@/lib/news/appPreview";
import { fetchFullArticlePreview } from "./actions";

export type AppNewsPreviewStory = {
  title: string;
  description: string | null;
  source?: string | null;
  image_url?: string | null;
  article_url?: string | null;
  published_at?: string | null;
};

type AppNewsPreviewProps = {
  story: AppNewsPreviewStory;
  stateLabel: string;
  compact?: boolean;
  showFullStory?: boolean;
};

function formatPublishedAge(iso: string | null | undefined): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AppNewsPreview({
  story,
  stateLabel,
  compact = false,
  showFullStory = true,
}: AppNewsPreviewProps) {
  const preview = useMemo(
    () => getAppMapCardPreview(story.title, story.description),
    [story.title, story.description],
  );

  const [showRaw, setShowRaw] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [fullError, setFullError] = useState<string | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);
  const [fullSource, setFullSource] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);

  async function handleLoadFullStory() {
    if (!story.article_url) return;
    setFullLoading(true);
    setFullError(null);
    setShowFull(true);
    try {
      const result = await fetchFullArticlePreview({
        url: story.article_url,
        title: story.title,
      });
      if (result.error) {
        setFullError(result.error);
        setFullText(null);
        setFullSource(null);
      } else {
        setFullText(result.text);
        setFullSource(result.source);
      }
    } catch (err) {
      setFullError(err instanceof Error ? err.message : "Failed to load full story");
      setFullText(null);
      setFullSource(null);
    } finally {
      setFullLoading(false);
    }
  }

  const publishedLabel = formatPublishedAge(story.published_at);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          App preview · map card
        </h4>
        {preview.usesFallback ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
            Shows fallback in app
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            Preview text OK
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-[#0B1220] p-4 shadow-inner">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
          News of the day · {stateLabel}
        </p>

        {story.image_url ? (
          <img
            src={story.image_url}
            alt=""
            className={`mt-3 w-full rounded-xl border border-zinc-800 object-cover ${compact ? "h-28" : "h-44"}`}
          />
        ) : null}

        <p className={`mt-3 font-extrabold leading-snug text-slate-100 ${compact ? "line-clamp-3 text-base" : "text-base"}`}>
          {story.title}
        </p>

        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
          <span className="min-w-0 truncate">
            {story.source ?? "News"}
            {publishedLabel ? ` · ${publishedLabel}` : ""}
          </span>
          {story.article_url ? (
            <a
              href={story.article_url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-slate-600 transition hover:text-slate-400"
            >
              ↗
            </a>
          ) : null}
        </div>

        <p
          className={`mt-3 text-[13px] font-medium leading-6 text-slate-400 ${
            compact ? "line-clamp-4" : "line-clamp-7"
          } ${preview.usesFallback ? "italic text-slate-500" : ""}`}
        >
          {preview.displayText}
        </p>
      </div>

      {preview.rawDescription ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
          >
            <span>Raw NewsAPI description</span>
            <span>{showRaw ? "Hide" : "Show"}</span>
          </button>
          {showRaw ? (
            <p className="border-t border-zinc-800 px-3 py-2 text-xs leading-5 text-zinc-500 whitespace-pre-wrap break-words">
              {preview.rawDescription}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-zinc-600">No description from NewsAPI — app will show the fallback message.</p>
      )}

      {preview.cleanedDescription && preview.cleanedDescription !== preview.rawDescription ? (
        <details className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-500">
          <summary className="cursor-pointer font-medium text-zinc-400">Cleaned description (after scraper)</summary>
          <p className="mt-2 leading-5 whitespace-pre-wrap break-words">{preview.cleanedDescription}</p>
        </details>
      ) : null}

      {showFullStory && story.article_url ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Full story (news page)
            </p>
            <button
              type="button"
              onClick={handleLoadFullStory}
              disabled={fullLoading}
              className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
            >
              {fullLoading ? "Loading…" : showFull ? "Reload" : "Load preview"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            Scrapes the article URL via the same article-reader edge function the app uses.
          </p>

          {showFull && fullError ? (
            <p className="mt-3 text-xs text-rose-400">{fullError}</p>
          ) : null}

          {showFull && fullText ? (
            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
              {fullSource ? (
                <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-600">Source: {fullSource}</p>
              ) : null}
              <p className="text-xs leading-6 text-zinc-300 whitespace-pre-wrap break-words">{fullText}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
