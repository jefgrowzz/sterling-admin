// Plain sync helpers shared between the client page and the "use server" actions
// file. A "use server" module may only export async functions, so marketLabel
// (and the state-abbreviation maps it needs) must live outside actions.ts or
// Next.js silently drops it from the client bundle.

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC", "puerto rico": "PR", guam: "GU", "virgin islands": "VI",
  "american samoa": "AS", "northern mariana islands": "MP",
};

const STATE_DISPLAY_BY_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBREVIATIONS).map(([name, abbrev]) => [
    abbrev,
    name.replace(/\b\w/g, (char) => char.toUpperCase()),
  ]),
);

export function normalizeStateAbbreviation(state: string | null | undefined): string | null {
  const trimmed = (state ?? "").trim();
  if (!trimmed) return null;
  const mapped = STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  if (mapped) return mapped;
  return trimmed.length === 2 ? trimmed.toUpperCase() : trimmed;
}

export function marketLabel(state: string | null | undefined): string {
  const abbrev = normalizeStateAbbreviation(state);
  if (!abbrev) return "";
  return STATE_DISPLAY_BY_ABBREV[abbrev] ?? abbrev;
}
