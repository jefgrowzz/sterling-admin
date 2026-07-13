// Synced from Sterling src/lib/business/articleTextCleanup.ts — keep in step when app cleanup changes.

const JINA_HEADER_PATTERNS = [
  /^Title:\s*.+$/im,
  /^URL Source:\s*.+$/im,
  /^Published Time:\s*.+$/im,
  /^Markdown Content:\s*$/im,
  /^Author:\s*.+$/im,
  /^Warning:\s*.+$/im,
];

const INLINE_JUNK_PATTERNS = [
  /\s*\^?\s*Topics?:\s*[^.\n]+/gi,
  /\s*Keywords?:\s*[^.\n]+/gi,
  /\s*Tags?:\s*[^.\n]+/gi,
  /\s*\[\+\d+\s*chars\]\s*/gi,
  /\s*\(\s*opens in new (?:tab|window)\s*\)\s*/gi,
  /\s*\d+\s*min(?:ute)?s?\s*read\b/gi,
  /\s*presented by\s+[^.\n]+/gi,
  /\s*advertisement continues below\b/gi,
  /!\[[^\]]*\]\([^)]+\)/g,
  /https?:\/\/[^\s)\]>"']+/gi,
];

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?|$)|\/(?:images?|img|photos?|media|assets)\//i;
const SOCIAL_HOST_PATTERN = /(?:facebook|twitter|x\.com|linkedin|pinterest|reddit|whatsapp|telegram|tumblr)\./i;

const LINE_JUNK_PATTERNS = [
  /^skip to (comments?|content|main|navigation|primary)\.?$/i,
  /^jump to (comments?|content|main|navigation|primary)\.?$/i,
  /^skip (comments?|content)$/i,
  /^comments?$/i,
  /^share (this )?(article|story|post)\.?$/i,
  /^listen to (this )?(article|story)\.?$/i,
  /^read (more|full story)( info)?\.?$/i,
  /^continue reading\.?$/i,
  /^full (story|article)\.?$/i,
  /^advertisement$/i,
  /^related (articles?|stories|content|coverage)\.?$/i,
  /^more (stories|news|coverage|from\b.+)\.?$/i,
  /^you may also like\.?$/i,
  /^recommended (for you)?\.?$/i,
  /^trending (now|stories|news)?\.?$/i,
  /^editor'?s picks?\.?$/i,
  /^latest (news|stories|headlines)\.?$/i,
  /^popular (stories|articles|news)\.?$/i,
  /^see also\.?$/i,
  /^further reading\.?$/i,
  /^around the web\.?$/i,
  /^from our network\.?$/i,
  /^sponsored content\.?$/i,
  /^sign up( for .*)?$/i,
  /^subscribe( now)?$/i,
  /^copyright\b/i,
  /^all rights reserved\.?$/i,
  /^(facebook|twitter|x|linkedin|email|print|reddit|pinterest)$/i,
  /^topics?\s*:/i,
  /^keywords?\s*:/i,
  /^tags?\s*:/i,
  /^accessibility help\b/i,
  /^search suggestions\b/i,
  /^sign in\.?$/i,
  /^quick links\b/i,
  /^use up and down arrow\b/i,
  /^keyboard shortcuts\b/i,
  /^main menu\b/i,
  /^share on\b/i,
  /^share (via|using)\b/i,
  /^copy link\b/i,
  /^text to speech\b/i,
  /^read aloud\b/i,
  /^listen to (this )?(article|story|page)\b/i,
  /^email (this )?(article|story)\b/i,
  /^print (this )?(article|story|page)\b/i,
  /^image link\b/i,
  /^photo\b/i,
  /^gallery\b/i,
  /^caption\b/i,
  /^credit\b/i,
  /^(getty|ap photo|reuters)\b/i,
  /^icon\b/i,
  /^opens in new (tab|window)\b/i,
  /^updated\s+(?:on|at)\b/i,
  /^published\s+(?:on|at)\b/i,
  /^posted\s+(?:on|at)\b/i,
  /^by\s+[A-Z][\w'.-]+(?:\s+[A-Z][\w'.-]+){0,3}\.?$/i,
  /^photo:\s*/i,
  /^image:\s*/i,
  /^file photo\b/i,
  /^getty images\b/i,
  /^shutterstock\b/i,
  /^watch:\s*/i,
  /^video:\s*/i,
  /^live updates?\b/i,
  /^breaking:\s*/i,
  /^exclusive:\s*/i,
  /^opinion:\s*/i,
  /^analysis:\s*/i,
  /^newsletter\b/i,
  /^sign up for\b/i,
  /^get our\b/i,
  /^follow us\b/i,
  /^join our\b/i,
  /^click here\b/i,
  /^learn more\b/i,
  /^cookie\b/i,
  /^privacy policy\b/i,
  /^terms of (use|service)\b/i,
  /^log in\b/i,
  /^create (?:a )?account\b/i,
  /^my account\b/i,
  /^presented by\b/i,
  /^advertisement continues\b/i,
  /^\d+\s*min(?:ute)?s?\s*read\.?$/i,
];

const NAV_CHROME_PHRASES = [
  'skip to main content',
  'skip to content',
  'accessibility help',
  'search suggestions are available',
  'use up and down arrow',
  'sign in',
  'log in',
  'create account',
  'quick links',
  'jump to navigation',
  'keyboard shortcuts',
  'main menu',
  'opens in new window',
  'opens in new tab',
  'copy link',
  'text to speech',
  'read aloud',
  'advertisement continues',
  'presented by',
];

const RELATED_SECTION_PATTERNS = [
  /^related\b/i,
  /^more (stories|news|coverage|from\b)/i,
  /^read more\b/i,
  /^continue reading\b/i,
  /^you may also like\b/i,
  /^recommended\b/i,
  /^trending\b/i,
  /^editor'?s picks?\b/i,
  /^latest (news|stories|headlines)\b/i,
  /^popular (stories|articles|news)\b/i,
  /^see also\b/i,
  /^further reading\b/i,
  /^around the web\b/i,
  /^from our network\b/i,
  /^sponsored\b/i,
  /^advertisement\b/i,
  /^also read\b/i,
  /^don't miss\b/i,
  /^in case you missed it\b/i,
];

function stripJinaHeaders(text: string): string {
  let result = text;
  for (const pattern of JINA_HEADER_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

function stripInlineJunk(text: string): string {
  let result = stripMarkdownArtifacts(text);
  for (const pattern of INLINE_JUNK_PATTERNS) {
    result = result.replace(pattern, ' ');
  }
  return result.replace(/\s{2,}/g, ' ');
}

function isImageOrMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return IMAGE_URL_PATTERN.test(trimmed);
}

function isSocialShareLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (trimmed.length <= 2) return true;
  if (/^(share|email|print|copy|listen|icon|photo|image|gallery|caption|credit)$/i.test(trimmed)) return true;
  if (/\b(share on|share via|copy link|text to speech|read aloud|listen to|opens in new)\b/i.test(lower)) return true;
  if (SOCIAL_HOST_PATTERN.test(lower) && trimmed.length < 48) return true;
  return false;
}

function stripMarkdownArtifacts(text: string): string {
  let result = String(text ?? '');
  result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ');
  result = result.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_match, label, url) => {
    const cleanLabel = String(label).trim();
    const cleanUrl = String(url).trim();
    if (!cleanLabel) return ' ';
    if (isImageOrMediaUrl(cleanUrl)) return ' ';
    if (SOCIAL_HOST_PATTERN.test(cleanUrl) && cleanLabel.length < 48) return ' ';
    if (isSocialShareLabel(cleanLabel)) return ' ';
    return cleanLabel;
  });
  return result;
}

/** Social buttons, bare image links, and reader chrome scraped into article text. */
export function isSocialShareLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (isSocialShareLabel(trimmed)) return true;
  if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(trimmed)) return true;
  if ((trimmed.match(/https?:\/\//gi) ?? []).length > 0 && trimmed.length < 120) return true;
  if (/\b(share on|share via|share this|copy link|text to speech|read aloud|listen to (this )?(article|story|page))\b/i.test(lower)) {
    return true;
  }
  if (/\b(facebook|twitter|linkedin|pinterest|whatsapp|telegram|reddit|email|print)\b/i.test(lower) && trimmed.length < 96) {
    return true;
  }
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(trimmed) && trimmed.length < 160) return true;
  return false;
}

/** True when a preview has enough real prose to show in the map card. */
export function isUsableNewsPreview(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 24) return false;
  if (isNavChromeText(trimmed) || isSocialShareLine(trimmed)) return false;
  if (/https?:\/\//i.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  const letters = (trimmed.match(/[a-z]/gi) ?? []).length;
  if (letters / trimmed.length < 0.55) return false;
  return true;
}

function isJunkLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 2) return true;
  if (isNavChromeText(trimmed)) return true;
  if (isSocialShareLine(trimmed)) return true;
  if (LINE_JUNK_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  if (/^[\w\s.&'"-]{2,36}\s*\^/.test(trimmed)) return true;
  return false;
}

function countNavChromePhrases(text: string): number {
  const lower = text.toLowerCase();
  return NAV_CHROME_PHRASES.filter((phrase) => lower.includes(phrase)).length;
}

/** Site chrome / a11y menus scraped into NewsAPI content or reader output. */
export function isNavChromeText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const hits = countNavChromePhrases(trimmed);
  if (hits >= 2) return true;
  if (hits >= 1 && trimmed.length < 140) return true;
  if (/^skip to\b/i.test(trimmed) && trimmed.length < 320) return true;
  if (/accessibility help menu/i.test(trimmed)) return true;
  return false;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&rsquo;|&#8217;/gi, "'")
    .replace(/&lsquo;|&#8216;/gi, "'")
    .replace(/&rdquo;|&#8221;/gi, '"')
    .replace(/&ldquo;|&#8220;/gi, '"')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&ndash;|&#8211;/gi, '–');
}

const LEADING_SOCIAL_RUN_RE =
  /^(?:(?:share|copy link|listen|text to speech|read aloud|opens in new (?:tab|window))|(?:facebook|twitter|x|linkedin|email|print|pinterest|reddit|whatsapp|telegram))(?:\s+|,\s*)+/i;

const LEADING_LABEL_RE =
  /^(?:(?:breaking|exclusive|watch|video|opinion|analysis|live updates?)\s*:\s*)+/i;

function stripLeadingBoilerplate(text: string): string {
  let result = stripLeadingChrome(text.trim());

  for (let pass = 0; pass < 8; pass += 1) {
    const stripped = result
      .replace(LEADING_SOCIAL_RUN_RE, '')
      .replace(LEADING_LABEL_RE, '')
      .replace(/^\(?(?:ap|reuters|afp|bloomberg)\)?\s*[-—:]\s*/i, '')
      .trim();
    const next = stripLeadingChrome(stripped);
    if (next === result) break;
    result = next;
  }

  return result.trim();
}

function isWeakParagraph(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (isJunkLine(trimmed) || isRelatedSectionHeading(trimmed)) return true;
  if (trimmed.length < 28 && !/[.!?]/.test(trimmed)) return true;
  if (/^by\s+[A-Z]/i.test(trimmed) && trimmed.length < 72) return true;
  return false;
}

const NAV_PREFIX_CHUNKS = [
  /^skip to(?: main)? content\s*/i,
  /^jump to(?: main)? content\s*/i,
  /^accessibility help(?: menu)?\s*/i,
  /^when search suggestions are available\s*/i,
  /^use up and down arrow[\w\s,.'"-]*\s*/i,
  /^search\s+search\s*/i,
  /^sign in\s*/i,
  /^quick links\s*/i,
  /^keyboard shortcuts\s*/i,
  /^main menu\s*/i,
  /^menu when\s*/i,
  /^search\s*/i,
  /^more\s+[a-z]+\s*/i,
  /^share on\s+[a-z]+\s*/i,
  /^share via\s+[a-z]+\s*/i,
  /^share this\s*/i,
  /^text to speech\s*/i,
  /^read aloud\s*/i,
  /^listen to(?: this)?(?: article| story| page)?\s*/i,
  /^copy link\s*/i,
  /^opens in new(?: tab| window)?\s*/i,
  /^image link\s*/i,
  /^(?:facebook|twitter|x|linkedin|email|print|pinterest|reddit|whatsapp|telegram)\s*/i,
  /^create (?:a )?account\s*/i,
  /^log in\s*/i,
  /^my account\s*/i,
  /^presented by\s+[\w\s]+\s*/i,
  /^advertisement continues(?: below)?\s*/i,
  /^(?:breaking|exclusive|watch|video|opinion|analysis):\s*/i,
  /^\(?(?:ap|reuters|afp|bloomberg)\)?\s*[-—]?\s*/i,
  /^follow us(?:\s+on)?\s+(?:facebook|twitter|x|instagram|linkedin)\s*/i,
  /^newsletter\s*/i,
];

function stripLeadingChrome(text: string): string {
  let result = text.trim();
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (const pattern of NAV_PREFIX_CHUNKS) {
      const next = result.replace(pattern, '').trim();
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
}

function stripBodyFromChromeBlob(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/\b([A-Z][a-z]{2,}(?:\s+[\w'’,.-]+){4,}[.!?]?)/);
  if (!match?.index || match.index <= 0 || match.index > 220) return trimmed;
  const prefix = trimmed.slice(0, match.index);
  if (isNavChromeText(prefix) || isSocialShareLine(prefix) || prefix.length < 180) {
    return trimmed.slice(match.index).trim();
  }
  return trimmed;
}

function stripNavPrefix(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  let result = stripLeadingChrome(trimmed);
  result = stripBodyFromChromeBlob(result);

  if (result.length >= 40 && !isNavChromeText(result) && !isSocialShareLine(result)) return result;
  if (!isNavChromeText(trimmed) && !/^skip to/i.test(trimmed) && !/accessibility help/i.test(trimmed) && !/^share on/i.test(trimmed)) {
    return trimmed;
  }

  const sentences = trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/);
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i].trim();
    if (sentence.length >= 40 && !isNavChromeText(sentence) && looksLikeBodyLine(sentence)) {
      return sentences.slice(i).join(' ');
    }
  }

  const segments = trimmed
    .split(/#{1,6}\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  for (const segment of segments) {
    if (segment.length >= 40 && !isNavChromeText(segment) && looksLikeBodyLine(segment)) {
      return segment;
    }
  }

  const periodIdx = trimmed.search(/[.!?]/);
  if (periodIdx > 0 && periodIdx < 180) {
    const prefix = trimmed.slice(0, periodIdx + 1);
    if (isNavChromeText(prefix)) {
      const rest = trimmed.slice(periodIdx + 1).trim();
      if (rest.length >= 24 && !isNavChromeText(rest)) return rest;
    }
  }

  return trimmed;
}

export function isRelatedSectionHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 96) return false;
  return RELATED_SECTION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isJunkArticleLine(text: string): boolean {
  if (isNavChromeText(text)) return true;
  return isJunkLine(text);
}

function looksLikeBodyLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length >= 72) return true;
  if (trimmed.length >= 36 && /[.!?]["']?$/.test(trimmed)) return true;
  return false;
}

function trimLeadingJunkLines(lines: string[]): string[] {
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      start = i + 1;
      continue;
    }
    if (isJunkLine(line)) {
      start = i + 1;
      continue;
    }
    if (looksLikeBodyLine(line)) {
      start = i;
      break;
    }
    if (line.length < 48 && !/[.!?]/.test(line)) {
      start = i + 1;
      continue;
    }
    start = i;
    break;
  }
  return lines.slice(start);
}

function trimTrailingJunkLines(lines: string[]): string[] {
  let end = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) {
      end = i;
      continue;
    }
    if (isJunkLine(line) || /^read more/i.test(line)) {
      end = i;
      continue;
    }
    break;
  }
  return lines.slice(0, end);
}

export function cleanArticleText(raw: string, options?: { title?: string }): string {
  try {
    let text = stripJinaHeaders(stripInlineJunk(String(raw ?? '')))
      .replace(/\r\n/g, '\n')
      .replace(/\t+/g, ' ')
      .replace(/[ \u00A0]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    text = stripNavPrefix(text.replace(/#{1,6}\s*/g, ' '));

    const title = options?.title?.trim();
    if (title && title.length < 180) {
      const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`^${escaped}\\s*`, 'i'), '');
    }

    const paragraphs = text
      .split(/\n{2,}/)
      .map((part) => part.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim())
      .filter(Boolean)
      .filter((part) => !isWeakParagraph(part));

    const cleaned = trimTrailingJunkLines(trimLeadingJunkLines(paragraphs)).join('\n\n').trim();
    return cleaned.length > 24_000 ? `${cleaned.slice(0, 24_000).trim()}…` : cleaned;
  } catch {
    const fallback = String(raw ?? '').trim();
    return fallback.length > 24_000 ? `${fallback.slice(0, 24_000).trim()}…` : fallback;
  }
}

export function extractJinaMarkdown(raw: string, options?: { title?: string }): string {
  let text = stripJinaHeaders(stripInlineJunk(String(raw ?? '')))
    .replace(/\r\n/g, '\n')
    .replace(/\t+/g, ' ')
    .replace(/[ \u00A0]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const title = options?.title?.trim();
  if (title && title.length < 180) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^#\\s*${escaped}\\s*\\n+`, 'i'), '');
    text = text.replace(new RegExp(`^${escaped}\\s*\\n+`, 'i'), '');
  }

  const lines = text.split('\n');
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      start = i + 1;
      continue;
    }
    if (/^#{1,4}\s/.test(line) || looksLikeBodyLine(line)) {
      start = i;
      break;
    }
    if (isJunkLine(line) || (line.length < 48 && !/[.!?]/.test(line))) {
      start = i + 1;
      continue;
    }
    start = i;
    break;
  }

  return trimTrailingJunkLines(lines.slice(start)).join('\n').trim();
}

/** NewsAPI `content` ends with this when the full article was not returned. */
export function isNewsApiTruncatedContent(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const trimmed = text.trim();
  if (/\[\+\d+\s*chars\]/i.test(trimmed)) return true;
  if (/^in the news release,/i.test(trimmed) && trimmed.length < 2_000) return true;
  return false;
}

/** Full article body safe to store or render — null when only a NewsAPI snippet. */
export function sanitizeStoredArticleContent(
  raw: string | null | undefined,
  title?: string | null,
): string | null {
  if (!raw?.trim() || isNewsApiTruncatedContent(raw)) return null;
  const cleaned = cleanArticleText(raw, { title: title ?? undefined });
  if (!cleaned || cleaned.length < 120) return null;
  if (isNavChromeText(cleaned) || isSocialShareLine(cleaned)) return null;
  return cleaned;
}

/** Clean NewsAPI description/content before showing a map preview. */
export function cleanNewsPreviewText(
  raw: string | null | undefined,
  title?: string | null,
): string | null {
  if (!raw?.trim()) return null;

  let text = stripHtml(stripInlineJunk(String(raw)))
    .replace(/\s*\[\+\d+\s*chars\]\s*/gi, '')
    .replace(/#{1,6}\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  text = stripLeadingBoilerplate(text);
  text = stripNavPrefix(text);
  text = cleanArticleText(text, { title: title ?? undefined });

  if (!text || isNavChromeText(text) || isSocialShareLine(text) || !isUsableNewsPreview(text)) return null;
  return text;
}
