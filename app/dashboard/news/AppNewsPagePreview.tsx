"use client";

import { useMemo } from "react";
import { parseStoredArticleContent } from "@/lib/news/articleContentStorage";
import { FormattedArticleBody } from "./FormattedArticleBody";
import type { AppNewsPreviewStory } from "./AppNewsPreview";

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

type AppNewsPagePreviewProps = {
  story: AppNewsPreviewStory;
  stateLabel: string;
  bodyText?: string | null;
  loading?: boolean;
};

export function AppNewsPagePreview({
  story,
  stateLabel,
  bodyText,
  loading = false,
}: AppNewsPagePreviewProps) {
  const blocks = useMemo(
    () => parseStoredArticleContent(bodyText, story.title),
    [bodyText, story.title],
  );

  const publishedLabel = formatPublishedAge(story.published_at);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          App preview · news page
        </h4>
        <p className="mt-1 text-xs text-zinc-600">
          Matches the in-app Read more screen formatting.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-[#0A0A0A] shadow-inner">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-center text-[17px] font-extrabold text-slate-100">News of the day</p>
          {stateLabel ? (
            <p className="mt-0.5 text-center text-xs font-semibold text-slate-500">{stateLabel}</p>
          ) : null}
        </div>

        <div className="space-y-4 p-4">
          {story.image_url ? (
            <img
              src={story.image_url}
              alt=""
              className="h-44 w-full rounded-2xl border border-zinc-800 object-cover"
            />
          ) : null}

          <div className="space-y-2">
            <p className="text-2xl font-extrabold leading-8 tracking-tight text-slate-50">
              {story.title}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              {story.source ?? "News"}
              {publishedLabel ? ` · ${publishedLabel}` : ""}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
              Loading full article…
            </div>
          ) : blocks.length > 0 ? (
            <FormattedArticleBody blocks={blocks} />
          ) : (
            <p className="py-6 text-sm italic text-slate-500">
              Full article body will appear here once loaded or pasted in the editor.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
