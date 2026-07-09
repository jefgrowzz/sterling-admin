import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/app/dashboard/lib/dal";
import {
  fetchOverride,
  saveOverride,
  clearOverride,
  type NewsCandidate,
} from "@/app/dashboard/news/actions";
import { getTodayUtcDate } from "@/app/dashboard/news/date";

// Service-role-only admin endpoints backing the News tab. getCurrentAdmin() redirects
// unauthenticated/non-staff callers, which for a route handler surfaces as a 307 to
// "/" rather than a JSON error — acceptable here since this is only ever called from
// the authenticated dashboard UI, not a public API surface.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const state = searchParams.get("state");
  const date = searchParams.get("date");

  if (!city) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  await getCurrentAdmin();

  try {
    const override = await fetchOverride({
      city,
      state: state || null,
      dateUtc: date || getTodayUtcDate(),
    });
    return NextResponse.json({ override });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch override" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  await getCurrentAdmin();

  const body = await req.json();
  const { date_utc, city, state, reason, ...candidateFields } = body ?? {};

  if (!date_utc || !city || !candidateFields.title || !candidateFields.article_url) {
    return NextResponse.json(
      { error: "date_utc, city, title, and article_url are required" },
      { status: 400 }
    );
  }

  const candidate: NewsCandidate = {
    article_id: candidateFields.article_id ?? null,
    article_url: candidateFields.article_url,
    title: candidateFields.title,
    description: candidateFields.description ?? null,
    content: candidateFields.content ?? null,
    source: candidateFields.source ?? null,
    image_url: candidateFields.image_url ?? null,
    published_at: candidateFields.published_at ?? null,
  };

  try {
    const override = await saveOverride({ dateUtc: date_utc, city, state, candidate, reason });
    return NextResponse.json({ override });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save override" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await getCurrentAdmin();

  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const state = searchParams.get("state");
  const date = searchParams.get("date");

  if (!city || !date) {
    return NextResponse.json({ error: "city and date are required" }, { status: 400 });
  }

  try {
    await clearOverride({ dateUtc: date, city, state: state || null });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to clear override" }, { status: 500 });
  }
}
