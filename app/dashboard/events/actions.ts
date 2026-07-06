"use server";

import { supabaseAdmin } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export type EventHost = {
  full_name: string | null;
  username: string | null;
  email: string | null;
} | null;

export type EventItem = {
  id: string;
  host_id: string | null;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  starts_at: string | null;
  duration_minutes: number | null;
  event_type: string | null;
  is_private: boolean | null;
  attendee_count: number | null;
  notes: string | null;
  created_at: string | null;
  host: EventHost;
};

export type EventAttendee = {
  user_id: string;
  joined_at: string | null;
  profile: EventHost;
};

export type EventFilter = "upcoming" | "past";

const EVENT_COLUMNS =
  "id,host_id,name,address,lat,lng,starts_at,duration_minutes,event_type,is_private,attendee_count,notes,created_at";

async function attachHosts(events: Omit<EventItem, "host">[]): Promise<EventItem[]> {
  const hostIds = [...new Set(events.map((e) => e.host_id).filter(Boolean))] as string[];
  if (hostIds.length === 0) {
    return events.map((e) => ({ ...e, host: null }));
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,username,email")
    .in("id", hostIds);
  if (error) throw new Error(error.message);

  const hostById = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null; username: string | null; email: string | null }[]).map(
      (p) => [p.id, { full_name: p.full_name, username: p.username, email: p.email }]
    )
  );

  return events.map((e) => ({ ...e, host: (e.host_id && hostById.get(e.host_id)) || null }));
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchEvents(
  page: number,
  search = "",
  filter: EventFilter = "upcoming"
): Promise<{ events: EventItem[]; totalCount: number }> {
  const offset = (page - 1) * PAGE_SIZE;
  const now = new Date().toISOString();

  let countQuery = supabaseAdmin.from("events").select("*", { count: "exact", head: true });
  let dataQuery = supabaseAdmin
    .from("events")
    .select(EVENT_COLUMNS)
    .range(offset, offset + PAGE_SIZE - 1);

  if (filter === "upcoming") {
    countQuery = countQuery.gte("starts_at", now);
    dataQuery = dataQuery.gte("starts_at", now).order("starts_at", { ascending: true });
  } else {
    countQuery = countQuery.lt("starts_at", now);
    dataQuery = dataQuery.lt("starts_at", now).order("starts_at", { ascending: false });
  }

  if (search.trim()) {
    const term = search.trim();
    countQuery = countQuery.or(`name.ilike.%${term}%,address.ilike.%${term}%`);
    dataQuery = dataQuery.or(`name.ilike.%${term}%,address.ilike.%${term}%`);
  }

  const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery]);
  if (error) throw new Error(error.message);

  const events = await attachHosts((data ?? []) as Omit<EventItem, "host">[]);

  return { events, totalCount: count ?? 0 };
}

export async function fetchEventCounts(): Promise<{ upcoming: number; past: number }> {
  const now = new Date().toISOString();

  const [{ count: upcoming }, { count: past }] = await Promise.all([
    supabaseAdmin.from("events").select("*", { count: "exact", head: true }).gte("starts_at", now),
    supabaseAdmin.from("events").select("*", { count: "exact", head: true }).lt("starts_at", now),
  ]);

  return { upcoming: upcoming ?? 0, past: past ?? 0 };
}

export async function fetchEventAttendees(eventId: string): Promise<EventAttendee[]> {
  const { data, error } = await supabaseAdmin
    .from("event_attendees")
    .select("user_id,joined_at")
    .eq("event_id", eventId)
    .order("joined_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { user_id: string; joined_at: string | null }[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length === 0) return [];

  const { data: profiles, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,username,email")
    .in("id", userIds);
  if (profileErr) throw new Error(profileErr.message);

  const profileById = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null; username: string | null; email: string | null }[]).map(
      (p) => [p.id, { full_name: p.full_name, username: p.username, email: p.email }]
    )
  );

  return rows.map((r) => ({
    user_id: r.user_id,
    joined_at: r.joined_at,
    profile: profileById.get(r.user_id) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function updateEvent(
  id: string,
  updates: {
    name?: string | null;
    event_type?: string | null;
    is_private?: boolean | null;
    duration_minutes?: number | null;
    starts_at?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const { error } = await supabaseAdmin.from("events").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeEventAttendee(eventId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("event_attendees")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
