"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs } from "@/components/dashboard/Tabs";
import {
  fetchActiveBans,
  fetchActiveDeviceBans,
  unbanUser,
  type ActiveBan,
  type ActiveDeviceBan,
  type BanType,
} from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BAN_TYPE_LABELS: Record<BanType, string> = {
  general: "General",
  harassment: "Harassment",
  spam: "Spam",
  content_violation: "Content Violation",
};

const BAN_TYPE_BADGE: Record<BanType, string> = {
  general: "bg-zinc-800 text-zinc-400",
  harassment: "bg-rose-500/15 text-rose-300",
  spam: "bg-amber-500/15 text-amber-300",
  content_violation: "bg-rose-500/15 text-rose-300",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name?: string | null): string {
  if (!name?.trim()) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_PALETTES = [
  "bg-violet-500/15 text-violet-300",
  "bg-blue-500/15 text-blue-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-amber-500/15 text-amber-300",
  "bg-rose-500/15 text-rose-300",
];

function avatarColor(id: string): string {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}

function ExpiresBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return (
      <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        Permanent
      </span>
    );
  }
  return <span className="text-zinc-400">{formatDate(expiresAt)}</span>;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function RowSkeleton({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-700" />
        </td>
      ))}
    </tr>
  );
}

function TableSkeleton({ headers }: { headers: string[] }) {
  return (
    <div className="-mx-6 -mb-6 overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-800/60 text-left text-zinc-400">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-6 py-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <RowSkeleton key={i} cols={headers.length} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User bans
// ---------------------------------------------------------------------------

const USER_BAN_HEADERS = ["User", "Ban Type", "Reason", "Banned On", "Expires", "Actions"];

function UserBansTable({
  bans,
  unbanningId,
  onUnban,
}: {
  bans: ActiveBan[];
  unbanningId: string | null;
  onUnban: (userId: string) => void;
}) {
  return (
    <div className="-mx-6 -mb-6 overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-800/60 text-left text-zinc-400">
          <tr>
            {USER_BAN_HEADERS.map((h) => (
              <th key={h} className="px-6 py-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {bans.map((ban) => {
            const initials = getInitials(ban.full_name);
            const color = avatarColor(ban.user_id);
            return (
              <tr key={ban.ban_id} className="hover:bg-zinc-800/60 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-50">{ban.full_name ?? "Unknown user"}</p>
                      <p className="truncate text-xs text-zinc-500">{ban.email ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${BAN_TYPE_BADGE[ban.ban_type]}`}>
                    {BAN_TYPE_LABELS[ban.ban_type] ?? ban.ban_type}
                  </span>
                </td>
                <td className="max-w-xs px-6 py-4 text-zinc-400">
                  <p className="line-clamp-2">{ban.reason}</p>
                </td>
                <td className="px-6 py-4 text-zinc-400">{formatDate(ban.created_at)}</td>
                <td className="px-6 py-4">
                  <ExpiresBadge expiresAt={ban.expires_at} />
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onUnban(ban.user_id)}
                    disabled={unbanningId === ban.user_id}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {unbanningId === ban.user_id ? "Unbanning…" : "Unban"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Device bans
// ---------------------------------------------------------------------------

const DEVICE_BAN_HEADERS = ["Device", "Linked User", "Reason", "Banned On", "Expires", "Actions"];

function DeviceBansTable({
  bans,
  unbanningId,
  onUnban,
}: {
  bans: ActiveDeviceBan[];
  unbanningId: string | null;
  onUnban: (userId: string) => void;
}) {
  return (
    <div className="-mx-6 -mb-6 overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-800/60 text-left text-zinc-400">
          <tr>
            {DEVICE_BAN_HEADERS.map((h) => (
              <th key={h} className="px-6 py-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {bans.map((ban) => (
            <tr key={ban.ban_id} className="hover:bg-zinc-800/60 transition-colors">
              <td className="px-6 py-4">
                <span className="font-mono text-xs text-zinc-400">{ban.device_id.slice(0, 16)}…</span>
              </td>
              <td className="px-6 py-4 text-zinc-50">
                {ban.full_name ?? <span className="text-zinc-500">Unlinked</span>}
              </td>
              <td className="max-w-xs px-6 py-4 text-zinc-400">
                <p className="line-clamp-2">{ban.reason}</p>
              </td>
              <td className="px-6 py-4 text-zinc-400">{formatDate(ban.created_at)}</td>
              <td className="px-6 py-4">
                <ExpiresBadge expiresAt={ban.expires_at} />
              </td>
              <td className="px-6 py-4">
                <button
                  onClick={() => ban.linked_user_id && onUnban(ban.linked_user_id)}
                  disabled={!ban.linked_user_id || unbanningId === ban.linked_user_id}
                  title={ban.linked_user_id ? undefined : "No linked user — cannot unban"}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {unbanningId === ban.linked_user_id ? "Unbanning…" : "Unban"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BannedUsersPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [userBans, setUserBans] = useState<ActiveBan[]>([]);
  const [deviceBans, setDeviceBans] = useState<ActiveDeviceBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanningId, setUnbanningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const refreshData = useCallback(() => {
    setLoading(true);
    setLastRefresh(new Date());
    Promise.all([fetchActiveBans(), fetchActiveDeviceBans()])
      .then(([bans, devices]) => {
        setUserBans(bans);
        setDeviceBans(devices);
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  async function handleUnban(userId: string) {
    setUnbanningId(userId);
    setError(null);
    try {
      await unbanUser(userId);
      setUserBans((prev) => prev.filter((b) => b.user_id !== userId));
      setDeviceBans((prev) => prev.filter((d) => d.linked_user_id !== userId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUnbanningId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-400">Safety</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Banned Users</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Manage active user and device bans. Review ban reasons, expiry, and unban when necessary.
            </p>
          </div>
          <button
            onClick={refreshData}
            disabled={loading}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Last updated: {lastRefresh.toLocaleTimeString()}</p>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <Tabs
          tabs={[
            { id: "users", label: "User bans", count: loading ? undefined : userBans.length, color: "rose" },
            { id: "devices", label: "Device bans", count: loading ? undefined : deviceBans.length, color: "amber" },
          ]}
          defaultTab="users"
          variant="underline"
          onChange={setActiveTab}
        />

        <div className="mt-6">
          {activeTab === "users" ? (
            loading ? (
              <TableSkeleton headers={USER_BAN_HEADERS} />
            ) : userBans.length === 0 ? (
              <EmptyState label="No active user bans" />
            ) : (
              <UserBansTable bans={userBans} unbanningId={unbanningId} onUnban={handleUnban} />
            )
          ) : loading ? (
            <TableSkeleton headers={DEVICE_BAN_HEADERS} />
          ) : deviceBans.length === 0 ? (
            <EmptyState label="No active device bans" />
          ) : (
            <DeviceBansTable bans={deviceBans} unbanningId={unbanningId} onUnban={handleUnban} />
          )}
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300 shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-rose-200 hover:text-rose-100">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
