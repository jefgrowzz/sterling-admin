import { isJunkArticleLine, isRelatedSectionHeading, isSocialShareLine } from './articleTextCleanup';

export type ArticleSpan =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'link'; text: string; href: string };

export type ArticleBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; spans: ArticleSpan[] }
  | { type: 'list'; ordered: boolean; items: ArticleSpan[][] }
  | { type: 'quote'; spans: ArticleSpan[] };

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

const TRANSPARENT_INLINE_TAGS = 'span|div|section|article|font|mark|label|small|sup|sub';

function sanitizeSpanText(text: string): string {
  return decodeHtmlEntities(text)
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '')
    .replace(/<\/?[a-z][a-z0-9]*>/gi, '')
    .replace(
      /\/?(?:span|blockquote|div|p|section|article|font|mark|em|strong|b|i|a|h[1-6]|ul|ol|li)\s*>/gi,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripRemainingTags(value: string): string {
  return sanitizeSpanText(value.replace(/<br\s*\/?>/gi, '\n'));
}

function unwrapTransparentInlineTags(html: string): string {
  const pattern = new RegExp(`<(${TRANSPARENT_INLINE_TAGS})(\\s[^>]*)?>([\\s\\S]*?)<\\/\\1>`, 'gi');
  let result = html;
  for (let i = 0; i < 8; i += 1) {
    const next = result.replace(pattern, '$3');
    if (next === result) break;
    result = next;
  }
  return result;
}

function flattenNestedBlockHtml(html: string): string {
  return unwrapTransparentInlineTags(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/blockquote>\s*<blockquote[^>]*>/gi, '\n\n')
    .replace(/<blockquote[^>]*>/gi, '')
    .replace(/<\/blockquote>/gi, '\n');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function spansToPlainText(spans: ArticleSpan[]): string {
  return spans.map((span) => span.text).join('');
}

function normalizeSpans(spans: ArticleSpan[]): ArticleSpan[] {
  return spans
    .map((span) => ({ ...span, text: sanitizeSpanText(span.text) }))
    .filter((span) => {
      if (!span.text.length) return false;
      if (span.type === 'link') {
        if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(span.href)) return false;
        if (/^(share|email|print|copy|listen|icon|photo|image)$/i.test(span.text)) return false;
      }
      return true;
    });
}

function parseInlineHtml(html: string): ArticleSpan[] {
  const spans: ArticleSpan[] = [];
  let remaining = unwrapTransparentInlineTags(html);

  while (remaining.length > 0) {
    const styledMatch = remaining.match(/^<(strong|b|em|i|a)(\s+[^>]*?)?>([\s\S]*?)<\/\1>/i);
    if (styledMatch) {
      const tag = styledMatch[1].toLowerCase();
      const inner = parseInlineHtml(styledMatch[3]);
      const text = sanitizeSpanText(spansToPlainText(inner) || styledMatch[3]);
      if (text) {
        if (tag === 'strong' || tag === 'b') spans.push({ type: 'bold', text });
        else if (tag === 'em' || tag === 'i') spans.push({ type: 'italic', text });
        else if (tag === 'a') {
          const href = (styledMatch[2] ?? '').match(/href=["']([^"']+)["']/i)?.[1] ?? '';
          spans.push({ type: 'link', text, href });
        } else spans.push({ type: 'text', text });
      }
      remaining = remaining.slice(styledMatch[0].length);
      continue;
    }

    const nextTag = remaining.indexOf('<');
    if (nextTag === -1) {
      const text = sanitizeSpanText(stripRemainingTags(remaining));
      if (text) spans.push({ type: 'text', text });
      break;
    }

    if (nextTag > 0) {
      const text = sanitizeSpanText(stripRemainingTags(remaining.slice(0, nextTag)));
      if (text) spans.push({ type: 'text', text });
    }

    const unknownTag = remaining.slice(nextTag).match(/^<[^>]+>/);
    if (unknownTag) {
      remaining = remaining.slice(nextTag + unknownTag[0].length);
      continue;
    }

    remaining = remaining.slice(nextTag + 1);
  }

  if (!spans.length) {
    const plain = sanitizeSpanText(stripRemainingTags(html));
    if (plain) spans.push({ type: 'text', text: plain });
  }

  return normalizeSpans(spans);
}

function parseListItems(html: string): ArticleSpan[][] {
  const items: ArticleSpan[][] = [];
  const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null = itemRegex.exec(html);
  while (match) {
    const spans = parseInlineHtml(match[1]);
    if (spans.length) items.push(spans);
    match = itemRegex.exec(html);
  }
  return items;
}

export function parseArticleHtml(html: string): ArticleBlock[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .trim();

  const blocks: ArticleBlock[] = [];
  const blockRegex = /<(h1|h2|h3|h4|p|ul|ol|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null = blockRegex.exec(cleaned);

  while (match) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    if (tag.startsWith('h')) {
      const level = Number(tag[1]) as 1 | 2 | 3 | 4;
      const text = collapseWhitespace(stripRemainingTags(inner));
      if (text) blocks.push({ type: 'heading', level, text });
    } else if (tag === 'p') {
      const spans = parseInlineHtml(inner);
      if (spans.length) blocks.push({ type: 'paragraph', spans });
    } else if (tag === 'ul' || tag === 'ol') {
      const items = parseListItems(inner);
      if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
    } else if (tag === 'blockquote') {
      const spans = parseInlineHtml(flattenNestedBlockHtml(inner));
      if (spans.length) blocks.push({ type: 'quote', spans });
    }
    match = blockRegex.exec(cleaned);
  }

  return blocks;
}

function parseMarkdownInline(text: string): ArticleSpan[] {
  const stripped = stripRemainingTags(unwrapTransparentInlineTags(text));
  const spans: ArticleSpan[] = [];
  const regex = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|\[([^\]]+)\]\(([^)]+)\)|([^*_[]+)/g;
  let match: RegExpExecArray | null = regex.exec(stripped);

  while (match) {
    if (match[2]) spans.push({ type: 'bold', text: sanitizeSpanText(match[2]) });
    else if (match[4]) spans.push({ type: 'italic', text: sanitizeSpanText(match[4]) });
    else if (match[5]) {
      spans.push({
        type: 'link',
        text: sanitizeSpanText(match[5]),
        href: match[6].trim(),
      });
    } else if (match[7]) {
      const plain = sanitizeSpanText(match[7].replace(/\s+/g, ' '));
      if (plain) spans.push({ type: 'text', text: plain });
    }
    match = regex.exec(stripped);
  }

  if (!spans.length && stripped.trim()) {
    spans.push({ type: 'text', text: sanitizeSpanText(stripped) });
  }
  return normalizeSpans(spans);
}

export function parseArticleMarkdown(markdown: string): ArticleBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ArticleBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(line) || isJunkArticleLine(line) || isSocialShareLine(line)) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const headingText = collapseWhitespace(heading[2]);
      if (!isJunkArticleLine(headingText) && !isSocialShareLine(headingText)) {
        blocks.push({
          type: 'heading',
          level: heading[1].length as 1 | 2 | 3 | 4,
          text: headingText,
        });
      }
      index += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', spans: parseMarkdownInline(quoteLines.join(' ')) });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: ArticleSpan[][] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(parseMarkdownInline(lines[index].trim().replace(/^[-*]\s+/, '')));
        index += 1;
      }
      if (items.length) blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: ArticleSpan[][] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(parseMarkdownInline(lines[index].trim().replace(/^\d+\.\s+/, '')));
        index += 1;
      }
      if (items.length) blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^#{1,4}\s/.test(lines[index].trim())) {
      const nextLine = lines[index].trim();
      if (!/^!\[[^\]]*\]\([^)]+\)\s*$/.test(nextLine) && !isJunkArticleLine(nextLine) && !isSocialShareLine(nextLine)) {
        paragraphLines.push(nextLine);
      }
      index += 1;
    }
    if (paragraphLines.length) {
      blocks.push({ type: 'paragraph', spans: parseMarkdownInline(paragraphLines.join(' ')) });
    }
  }

  return blocks;
}

export function parsePlainArticleText(text: string): ArticleBlock[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);

  return filterArticleBlocks(
    paragraphs.map((paragraph) => {
      if (paragraph.length <= 72 && !/[.!?]["']?$/.test(paragraph) && paragraph === paragraph.toUpperCase()) {
        return { type: 'heading' as const, level: 3 as const, text: paragraph };
      }
      if (paragraph.length <= 64 && !/[.!?]["']?$/.test(paragraph) && /^[A-Z0-9][^.!?]*$/.test(paragraph)) {
        return { type: 'heading' as const, level: 3 as const, text: paragraph };
      }
      return { type: 'paragraph' as const, spans: [{ type: 'text' as const, text: paragraph }] };
    }),
  );
}

function blockPlainText(block: ArticleBlock): string {
  switch (block.type) {
    case 'heading':
      return block.text;
    case 'paragraph':
      return spansToPlainText(block.spans);
    case 'quote':
      return spansToPlainText(block.spans);
    case 'list':
      return block.items.map((item) => spansToPlainText(item)).join(' ');
    default:
      return '';
  }
}

function isReadMoreLinkBlock(block: ArticleBlock): boolean {
  if (block.type !== 'paragraph') return false;
  const spans = block.spans;
  if (spans.length === 1 && spans[0].type === 'link') {
    return /^read more\b/i.test(spans[0].text);
  }
  const text = blockPlainText(block).trim();
  return /^read more\b/i.test(text) && text.length < 48;
}

function isJunkArticleBlock(block: ArticleBlock): boolean {
  const text = blockPlainText(block).trim();
  if (!text) return true;
  if (isReadMoreLinkBlock(block)) return true;
  if (isJunkArticleLine(text)) return true;
  if (isSocialShareLine(text)) return true;

  if (block.type === 'list') {
    const allLinkOnly =
      block.items.length >= 2 &&
      block.items.every((item) => item.length === 1 && item[0].type === 'link');
    if (allLinkOnly) return true;
  }

  return false;
}

function shouldTruncateBefore(block: ArticleBlock): boolean {
  const text = blockPlainText(block).trim();
  if (!text) return false;
  if (isRelatedSectionHeading(text)) return true;
  if (block.type === 'paragraph' && text.length < 80 && isRelatedSectionHeading(text)) return true;
  return false;
}

export function filterArticleBlocks(blocks: ArticleBlock[]): ArticleBlock[] {
  const result: ArticleBlock[] = [];

  for (const block of blocks) {
    if (shouldTruncateBefore(block)) break;
    if (isJunkArticleBlock(block)) continue;
    result.push(block);
  }

  while (result.length > 0 && isJunkArticleBlock(result[result.length - 1])) {
    result.pop();
  }

  return result;
}

export function parseArticleContent(input: {
  html?: string | null;
  markdown?: string | null;
  text?: string | null;
}): ArticleBlock[] {
  if (input.html?.trim()) {
    const fromHtml = filterArticleBlocks(parseArticleHtml(input.html));
    if (fromHtml.length) return fromHtml;
  }
  if (input.markdown?.trim()) {
    const fromMarkdown = filterArticleBlocks(parseArticleMarkdown(input.markdown));
    if (fromMarkdown.length) return fromMarkdown;
  }
  if (input.text?.trim()) {
    return parsePlainArticleText(input.text);
  }
  return [];
}
