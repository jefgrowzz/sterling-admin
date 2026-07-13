import { cleanNewsPreviewText, isUsableNewsPreview } from "./articleTextCleanup";

export const MAP_CARD_FALLBACK_TEXT = "Open to read the full story.";

export type AppMapCardPreview = {
  displayText: string;
  usesFallback: boolean;
  cleanedDescription: string | null;
  rawDescription: string | null;
};

/** Matches Sterling MarketNewsOfDayPanel.getArticlePreview(). */
export function getAppMapCardPreview(
  title: string,
  description: string | null | undefined,
): AppMapCardPreview {
  const rawDescription = description?.trim() || null;
  const cleanedDescription = cleanNewsPreviewText(rawDescription, title);
  const usesFallback = !cleanedDescription || !isUsableNewsPreview(cleanedDescription);
  return {
    displayText: usesFallback ? MAP_CARD_FALLBACK_TEXT : cleanedDescription,
    usesFallback,
    cleanedDescription,
    rawDescription,
  };
}
