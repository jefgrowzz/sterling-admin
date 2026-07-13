import {
  parseArticleContent,
  type ArticleBlock,
  type ArticleSpan,
} from "./articleContentParser";
import { cleanArticleText, extractJinaMarkdown } from "./articleTextCleanup";

function spansToMarkdown(spans: ArticleSpan[]): string {
  return spans
    .map((span) => {
      if (span.type === "bold") return `**${span.text}**`;
      if (span.type === "italic") return `*${span.text}*`;
      if (span.type === "link" && span.href) return `[${span.text}](${span.href})`;
      return span.text;
    })
    .join("");
}

export function blocksToMarkdown(blocks: ArticleBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `${"#".repeat(block.level)} ${block.text}`;
        case "paragraph":
          return spansToMarkdown(block.spans);
        case "quote":
          return `> ${spansToMarkdown(block.spans)}`;
        case "list":
          return block.items
            .map((item, index) =>
              block.ordered
                ? `${index + 1}. ${spansToMarkdown(item)}`
                : `- ${spansToMarkdown(item)}`,
            )
            .join("\n");
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

function looksLikeHtml(value: string): boolean {
  return /<(p|h[1-6]|ul|ol|blockquote|div)\b/i.test(value);
}

function looksLikeMarkdown(value: string): boolean {
  return /^(?:#{1,4}\s|[-*]\s|\d+\.\s|>\s)/m.test(value);
}

/** Re-flow a single dense paragraph into multiple blocks for preview/editing. */
function splitDensePlainText(text: string): string {
  if (/\n{2,}/.test(text) || text.length < 320) return text;

  const sentences =
    text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ??
    [text.trim()];

  if (sentences.length < 4) return text;

  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    current.push(sentence);
    const chunk = current.join(" ");
    if (chunk.length >= 240 || current.length >= 3) {
      paragraphs.push(chunk);
      current = [];
    }
  }

  if (current.length) paragraphs.push(current.join(" "));
  return paragraphs.length >= 2 ? paragraphs.join("\n\n") : text;
}

export function buildStoredArticleContent(
  payload: {
    html?: string | null;
    markdown?: string | null;
    text?: string | null;
  },
  options?: { title?: string },
): string | null {
  if (payload.markdown?.trim()) {
    const markdown =
      extractJinaMarkdown(payload.markdown, options) || payload.markdown.trim();
    if (markdown) return markdown;
  }

  if (payload.html?.trim()) {
    const blocks = parseArticleContent({ html: payload.html });
    if (blocks.length) return blocksToMarkdown(blocks);
  }

  if (payload.text?.trim()) {
    const cleaned = cleanArticleText(payload.text, options);
    if (!cleaned) return null;
    const blocks = parseArticleContent({ text: cleaned });
    if (blocks.length > 1) return blocksToMarkdown(blocks);
    return cleaned;
  }

  return null;
}

export function parseStoredArticleContent(
  content: string | null | undefined,
  title?: string | null,
): ReturnType<typeof parseArticleContent> {
  const trimmed = content?.trim();
  if (!trimmed) return [];

  if (looksLikeHtml(trimmed)) {
    const fromHtml = parseArticleContent({ html: trimmed });
    if (fromHtml.length) return fromHtml;
  }

  if (looksLikeMarkdown(trimmed)) {
    const fromMarkdown = parseArticleContent({ markdown: trimmed });
    if (fromMarkdown.length) return fromMarkdown;
  }

  const cleaned = cleanArticleText(trimmed, { title: title ?? undefined });
  const reflowed = splitDensePlainText(cleaned);
  return parseArticleContent({ markdown: reflowed, text: reflowed });
}
