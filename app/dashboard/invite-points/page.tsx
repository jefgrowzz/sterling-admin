"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  searchUsers,
  adjustInvitePoints,
  fetchRecentAdjustments,
  type UserSearchResult,
  type RecentAdjustment,
} from "./actions";

function userLabel(u: { email: string | null; username: string | null; full_name: string | null } | null): string {
  if (!u) return "Unknown user";
  return u.username ? `@${u.username}` : u.full_name ?? u.email ?? "Unknown user";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        positive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
      }`}
    >
      {positive ? "+" : ""}
      {delta}
    </span>
  );
}

function UserSearchPicker({
  selected,
  onSelect,
}: {
  selected: UserSearchResult | null;
  onSelect: (u: UserSearchResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      searchUsers(query)
        .then(setResults)
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-50">{userLabel(selected)}</p>
          <p className="truncate text-xs text-zinc-500">{selected.email ?? selected.id} · {selected.referral_count} points</p>
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery(""); }}
          className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name, username, or email"
        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
      />
      {open && query.trim() && (
        <div className="absolute z-10 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          {searching ? (
            <div className="px-3 py-3 text-sm text-zinc-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-zinc-500">No users found</div>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelect(u); setOpen(false); }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-zinc-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-50">{userLabel(u)}</p>
                  <p className="truncate text-xs text-zinc-500">{u.email ?? u.id}</p>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{u.referral_count} pts</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AdjustmentRowSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-800/60 p-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 rounded bg-zinc-700" />
        <div className="h-5 w-12 rounded-full bg-zinc-700" />
      </div>
      <div className="mt-2 h-3 w-full rounded bg-zinc-700" />
    </div>
  );
}

export default function InvitePointsPage() {
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [pointsDelta, setPointsDelta] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [adjustments, setAdjustments] = useState<RecentAdjustment[]>([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadAdjustments = useCallback(() => {
    setLoadingAdjustments(true);
    setListError(null);
    fetchRecentAdjustments(20)
      .then(setAdjustments)
      .catch((err) => setListError(err instanceof Error ? err.message : "Failed to load adjustments"))
      .finally(() => setLoadingAdjustments(false));
  }, []);

  useEffect(() => { loadAdjustments(); }, [loadAdjustments]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const delta = Number(pointsDelta);
    if (!selectedUser) {
      setFormError("Select a target user");
      return;
    }
    if (!Number.isInteger(delta) || delta === 0) {
      setFormError("Points must be a nonzero whole number");
      return;
    }
    if (!reason.trim()) {
      setFormError("Reason is required");
      return;
    }

    setSubmitting(true);
    try {
      const adjustment = await adjustInvitePoints({
        targetUserId: selectedUser.id,
        pointsDelta: delta,
        reason,
      });
      setToast({
        kind: "success",
        message: `${delta > 0 ? "Granted" : "Deducted"} ${Math.abs(delta)} points for ${userLabel(selectedUser)}. New balance: ${adjustment.new_referral_count}.`,
      });
      setSelectedUser(null);
      setPointsDelta("");
      setReason("");
      loadAdjustments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to adjust points";
      setFormError(message);
      setToast({ kind: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header + form */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Invite Points</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Adjust invite points</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Manually grant or deduct a user's invite (referral) point balance. Every adjustment is
          logged below and in the audit log. This does not affect this week's referral leaderboard,
          which is computed separately from referral signups.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Target user</span>
            <UserSearchPicker selected={selectedUser} onSelect={setSelectedUser} />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Points delta</span>
            <input
              type="number"
              step={1}
              value={pointsDelta}
              onChange={(e) => setPointsDelta(e.target.value)}
              placeholder="e.g. 5 or -3"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being adjusted?"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </label>

          {formError && (
            <div className="sm:col-span-2 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{formError}</div>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit adjustment"}
            </button>
          </div>
        </form>
      </div>

      {/* Audit trail */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Last {adjustments.length || 20} adjustments
        </h3>
        {loadingAdjustments ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <AdjustmentRowSkeleton key={i} />)}</div>
        ) : listError ? (
          <div className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{listError}</div>
        ) : adjustments.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
            No adjustments yet
          </div>
        ) : (
          <div className="space-y-3">
            {adjustments.map((a) => (
              <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-800/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-50">{userLabel(a.target)}</span>
                      <DeltaBadge delta={a.points_delta} />
                      <span className="text-xs text-zinc-500">current balance: {a.current_referral_count}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{a.reason}</p>
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      By {userLabel(a.admin)} · {formatDate(a.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${
            toast.kind === "success"
              ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
              : "bg-rose-500/15 text-rose-300 ring-rose-500/30"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
