"use client";

import type { ArticleBlock, ArticleSpan } from "@/lib/news/articleContentParser";

function renderSpans(spans: ArticleSpan[]) {
  return spans.map((span, index) => {
    if (span.type === "bold") {
      return (
        <strong key={index} className="font-extrabold text-slate-100">
          {span.text}
        </strong>
      );
    }
    if (span.type === "italic") {
      return (
        <em key={index} className="italic">
          {span.text}
        </em>
      );
    }
    if (span.type === "link" && span.href) {
      return (
        <a
          key={index}
          href={span.href}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-sky-400 underline underline-offset-2"
        >
          {span.text}
        </a>
      );
    }
    return <span key={index}>{span.text}</span>;
  });
}

export function FormattedArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const className =
            block.level === 1
              ? "mt-1 text-xl font-black leading-7 text-slate-50"
              : block.level === 2
                ? "text-[17px] font-extrabold leading-6 text-slate-50"
                : block.level === 3
                  ? "text-[15px] font-extrabold leading-6 text-slate-200"
                  : "text-sm font-bold leading-5 text-slate-300";
          return (
            <p key={`heading-${index}`} className={className}>
              {block.text}
            </p>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={`paragraph-${index}`} className="text-sm leading-[22px] text-slate-300">
              {renderSpans(block.spans)}
            </p>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={`quote-${index}`}
              className="rounded-lg border-l-[3px] border-sky-500/40 bg-sky-500/10 py-1 pl-3"
            >
              <p className="text-sm leading-[22px] text-slate-300">{renderSpans(block.spans)}</p>
            </blockquote>
          );
        }

        return (
          <ul key={`list-${index}`} className="space-y-2 pl-1">
            {block.items.map((item, itemIndex) => (
              <li key={`list-${index}-${itemIndex}`} className="text-sm leading-[22px] text-slate-300">
                <span className="font-bold text-slate-300">
                  {block.ordered ? `${itemIndex + 1}. ` : "• "}
                </span>
                {renderSpans(item)}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
