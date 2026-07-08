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

export async function fetchOverride(params: {
  city: string;
  state?: string | null;
  dateUtc: string;
}): Promise<NewsOverride | null> {
  const cityNorm = normalize(params.city);
  const stateNorm = normalize(params.state);

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

export async function fetchCandidates(params: {
  city: string;
  state?: string | null;
}): Promise<NewsCandidate[]> {
  const { data, error } = await supabaseAdmin.functions.invoke("market-news", {
    body: { city: params.city, state: params.state ?? null },
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
  const state = params.state?.trim() || null;
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
  const state = params.state?.trim() || null;
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
