import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/app/dashboard/lib/dal";

// There's no admin RPC for discussions and RLS only grants authenticated users
// read/own-row access, so this always runs through the service-role client.

export type DiscussionRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  center_lat: number;
  center_lng: number;
  radius_miles: number;
  location_hint: string | null;
  avg_rate: number | null;
  rate_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
};

export type ProfileStub = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };

export type DiscussionListItem = DiscussionRow & {
  creator: ProfileStub | null;
  report_count: number;
};

const SORTABLE_COLUMNS = new Set(["created_at", "comment_count", "rate_count", "avg_rate", "title"]);
// Fetched, filtered by report count, and paginated in JS rather than in SQL —
// supabase-js has no group-by for the reports join. Bounded to keep this cheap;
// revisit with a dedicated RPC if the discussions table grows past this.
const MAX_SCAN = 1000;

export async function GET(req: NextRequest) {
  await getCurrentAdmin();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const city = searchParams.get("city")?.trim() || "";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const minReports = Number(searchParams.get("minReports") ?? "0") || 0;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
  const sortParam = searchParams.get("sort") ?? "-created_at";
  const sortColumn = sortParam.replace(/^-/, "");
  const sortAscending = !sortParam.startsWith("-");

  if (!SORTABLE_COLUMNS.has(sortColumn)) {
    return NextResponse.json({ error: `Invalid sort column: ${sortColumn}` }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from("area_discussions")
      .select("*")
      .order(sortColumn, { ascending: sortAscending })
      .limit(MAX_SCAN);

    if (search) query = query.ilike("title", `%${search}%`);
    if (city) query = query.ilike("location_hint", `%${city}%`);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);

    const { data: discussions, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (discussions ?? []) as DiscussionRow[];
    const ids = rows.map((r) => r.id);
    const creatorIds = [...new Set(rows.map((r) => r.creator_id))];

    const [profilesRes, reportsRes] = await Promise.all([
      creatorIds.length
        ? supabaseAdmin.from("profiles").select("id,full_name,username,avatar_url").in("id", creatorIds)
        : Promise.resolve({ data: [] as ProfileStub[] }),
      ids.length
        ? supabaseAdmin
            .from("reports")
            .select("discussion_id")
            .eq("report_type", "area_discussion")
            .eq("status", "pending")
            .in("discussion_id", ids)
        : Promise.resolve({ data: [] as { discussion_id: string }[] }),
    ]);

    const profileMap = new Map<string, ProfileStub>(
      ((profilesRes.data as ProfileStub[]) ?? []).map((p) => [p.id, p])
    );
    const reportCounts = new Map<string, number>();
    for (const r of (reportsRes.data as { discussion_id: string }[]) ?? []) {
      reportCounts.set(r.discussion_id, (reportCounts.get(r.discussion_id) ?? 0) + 1);
    }

    let items: DiscussionListItem[] = rows.map((r) => ({
      ...r,
      creator: profileMap.get(r.creator_id) ?? null,
      report_count: reportCounts.get(r.id) ?? 0,
    }));

    if (minReports > 0) {
      items = items.filter((d) => d.report_count >= minReports);
    }

    const total = items.length;
    const start = (page - 1) * pageSize;
    const paginated = items.slice(start, start + pageSize);

    return NextResponse.json({ discussions: paginated, total, page, pageSize });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch discussions" }, { status: 500 });
  }
}
