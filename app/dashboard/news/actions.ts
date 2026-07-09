"use server";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/app/dashboard/lib/dal";
import { logAdminAction } from "@/app/dashboard/lib/audit-log";

// The mobile app calls public.get_market_news_override(p_city, p_state, p_date_utc)
// first and falls back to auto-selected news when no row is found. As of
// supabase/sql/market_news_requests.sql, every call to that RPC also upserts a row
// into market_news_requests — that's the source of truth for "markets the app is
// actually serving," which fetchMarkets() below reads from. This page manages the
// public.market_news_overrides table the RPC reads from.
export type NewsOverride = {
  id: string;
  date_utc: string;
  city: string;
  state: string | null;
  article_id: string | null;
  article_url: string | null;
  title: string;
  description: string | null;
  content: string | null;
  source: string | null;
  image_url: string | null;
  published_at: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsCandidate = {
  article_id: string | null;
  article_url: string;
  title: string;
  description: string | null;
  content: string | null;
  source: string | null;
  image_url: string | null;
  published_at: string | null;
};

// Normalizes whatever shape the "market-news" edge function returns for a single
// story into the fields this page and the overrides table both need.
function normalizeCandidate(raw: any): NewsCandidate {
  return {
    article_id: raw.article_id ?? raw.id ?? null,
    article_url: raw.article_url ?? raw.url ?? "",
    title: raw.title ?? "",
    description: raw.description ?? raw.summary ?? null,
    content: raw.content ?? null,
    source: raw.source ?? raw.source_name ?? raw.publisher ?? null,
    image_url: raw.image_url ?? raw.image ?? raw.urlToImage ?? null,
    published_at: raw.published_at ?? raw.publishedAt ?? null,
  };
}

// Mirrors the city_norm/state_norm generated columns on both market_news_overrides
// and market_news_requests, so JS-side lookups match what the DB considers "the
// same market" regardless of casing/whitespace.
function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

// The mobile app normalizes state to a 2-letter USPS abbreviation before calling
// get_market_news_override (e.g. "Texas" -> "TX"). Admin input isn't guaranteed to
// come in that form (an admin might type the full name), so every write path here
// runs state through this first — otherwise "Texas" and "TX" would be stored as
// different rows and the app's lookup would never match what was saved.
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

function normalizeStateAbbreviation(state: string | null | undefined): string | null {
  const trimmed = (state ?? "").trim();
  if (!trimmed) return null;
  const mapped = STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  if (mapped) return mapped;
  // Already a 2-letter code (or an unrecognized value) — uppercase and pass
  // through rather than reject, so unusual/territory codes aren't silently lost.
  return trimmed.length === 2 ? trimmed.toUpperCase() : trimmed;
}

export type Market = {
  city: string;
  state: string | null;
  requestCount: number;
  lastRequestedAt: string;
};

// Markets the mobile app has actually requested news for, most recently active
// first. Populated by the get_market_news_override RPC on every call — see
// supabase/sql/market_news_requests.sql.
export async function fetchMarkets(): Promise<Market[]> {
  const { data, error } = await supabaseAdmin
    .from("market_news_requests")
    .select("city,state,request_count,last_requested_at")
    .order("last_requested_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    city: row.city,
    state: row.state,
    requestCount: row.request_count,
    lastRequestedAt: row.last_requested_at,
  }));
}

// "Add market manually" used to only add to the client's local React state — it
// was never written to market_news_requests (the table fetchMarkets() reads
// from), so the market vanished again on refresh even after an override had
// been saved for it. This persists it for real, upserting the same way the RPC
// does so it behaves identically to a market discovered from live app traffic.
export async function addMarket(params: { city: string; state?: string | null }): Promise<Market> {
  const city = params.city.trim();
  const state = normalizeStateAbbreviation(params.state);
  if (!city) throw new Error("City is required");

  const cityNorm = normalize(city);
  const stateNorm = normalize(state);

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("market_news_requests")
    .select("city,state,request_count,last_requested_at")
    .eq("city_norm", cityNorm)
    .eq("state_norm", stateNorm)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (existing) {
    return {
      city: existing.city,
      state: existing.state,
      requestCount: existing.request_count,
      lastRequestedAt: existing.last_requested_at,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("market_news_requests")
    .insert({ city, state, request_count: 0 })
    .select("city,state,request_count,last_requested_at")
    .single();
  if (error) throw new Error(error.message);

  return {
    city: data.city,
    state: data.state,
    requestCount: data.request_count,
    lastRequestedAt: data.last_requested_at,
  };
}

export async function fetchOverride(params: {
  city: string;
  state?: string | null;
  dateUtc: string;
}): Promise<NewsOverride | null> {
  const cityNorm = normalize(params.city);
  const stateNorm = normalize(normalizeStateAbbreviation(params.state));

  const { data, error } = await supabaseAdmin
    .from("market_news_overrides")
    .select("*")
    .eq("date_utc", params.dateUtc)
    .eq("city_norm", cityNorm)
    .eq("state_norm", stateNorm)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return data ?? null;
}

// Batched alternative to calling fetchOverride() once per market — a single query
// for every override on a given date, matched back to markets in JS via
// city_norm/state_norm. Used by the markets list so all rows resolve together
// instead of each row firing its own request and popping in independently.
export async function fetchOverridesForDate(dateUtc: string): Promise<NewsOverride[]> {
  const { data, error } = await supabaseAdmin
    .from("market_news_overrides")
    .select("*")
    .eq("date_utc", dateUtc)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as NewsOverride[];
}

export async function fetchCandidates(params: {
  city: string;
  state?: string | null;
}): Promise<NewsCandidate[]> {
  const { data, error } = await supabaseAdmin.functions.invoke("market-news", {
    body: { city: params.city, state: normalizeStateAbbreviation(params.state) },
  });
  if (error) throw new Error(error.message);

  const stories = Array.isArray(data) ? data : data?.stories ?? data?.articles ?? [];
  return stories.map(normalizeCandidate).filter((c: NewsCandidate) => c.article_url && c.title);
}

export async function saveOverride(params: {
  dateUtc: string;
  city: string;
  state?: string | null;
  candidate: NewsCandidate;
  reason?: string;
}): Promise<NewsOverride> {
  const admin = await getCurrentAdmin();
  const state = normalizeStateAbbreviation(params.state);
  const cityNorm = normalize(params.city);
  const stateNorm = normalize(state);

  const payload = {
    date_utc: params.dateUtc,
    city: params.city,
    state,
    article_id: params.candidate.article_id,
    article_url: params.candidate.article_url,
    title: params.candidate.title,
    description: params.candidate.description,
    content: params.candidate.content,
    source: params.candidate.source,
    image_url: params.candidate.image_url,
    published_at: params.candidate.published_at,
    reason: params.reason?.trim() || null,
    created_by: admin.id,
    updated_at: new Date().toISOString(),
  };

  // Defensive: guarantees this market shows up in fetchMarkets() regardless of
  // how it got here (manual add, or a market whose only request row predates
  // this dashboard's tracking). No-ops if it already exists.
  await addMarket({ city: params.city, state });

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("market_news_overrides")
    .select("id")
    .eq("date_utc", params.dateUtc)
    .eq("city_norm", cityNorm)
    .eq("state_norm", stateNorm)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const { data, error } = existing
    ? await supabaseAdmin
        .from("market_news_overrides")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await supabaseAdmin
        .from("market_news_overrides")
        .insert(payload)
        .select("*")
        .single();
  if (error) throw new Error(error.message);

  await logAdminAction({
    category: "admin",
    action: existing ? "update_news_override" : "create_news_override",
    detail: `${params.city}${state ? `, ${state}` : ""} — ${params.dateUtc}: "${params.candidate.title}"`,
    targetType: "market_news_override",
    targetId: data.id,
    actorId: admin.id,
    actorLabel: admin.email,
  });

  return data;
}

export async function clearOverride(params: {
  dateUtc: string;
  city: string;
  state?: string | null;
}): Promise<void> {
  const admin = await getCurrentAdmin();
  const state = normalizeStateAbbreviation(params.state);
  const cityNorm = normalize(params.city);
  const stateNorm = normalize(state);

  const { error } = await supabaseAdmin
    .from("market_news_overrides")
    .delete()
    .eq("date_utc", params.dateUtc)
    .eq("city_norm", cityNorm)
    .eq("state_norm", stateNorm);
  if (error) throw new Error(error.message);

  await logAdminAction({
    category: "admin",
    action: "clear_news_override",
    detail: `${params.city}${state ? `, ${state}` : ""} — ${params.dateUtc}`,
    targetType: "market_news_override",
    actorId: admin.id,
    actorLabel: admin.email,
  });
}
