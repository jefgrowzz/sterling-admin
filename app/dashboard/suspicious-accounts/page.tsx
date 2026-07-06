"use client";

import { useState, useEffect } from "react";
import { Tabs } from "@/components/dashboard/Tabs";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Pagination } from "@/components/ui/Pagination";
import {
  fetchSuspiciousAccounts,
  dismissSuspiciousAccount,
  strikeUser,
  banUser,
  type SuspiciousAccount,
  type SuspicionLevel,
} from "./actions";

const PAGE_SIZE = 10;

const LEVEL_BADGE: Record<SuspicionLevel, string> = {
  High: "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40",
  Medium: "bg-amber-500/15 text-amber-300",
  Low: "bg-zinc-800 text-zinc-400",
};

function getInitials(name?: string | null, username?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return (username ?? "??").slice(0, 2).toUpperCase();
}

const AVATAR_PALETTES = [
  "bg-violet-500/15 text-violet-300",
  "bg-blue-500/15 text-blue-300",
  "bg-amber-500/15 text-amber-300",
  "bg-rose-500/15 text-rose-300",
];

function avatarColor(id: string): string {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[n % AVATAR_PALETTES.length];
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 shrink-0 rounded-full bg-zinc-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-zinc-700" />
          <div className="h-3 w-56 rounded bg-zinc-700" />
        </div>
        <div className="h-6 w-16 shrink-0 rounded-full bg-zinc-700" />
      </div>
    </div>
  );
}

function AccountCard({
  account,
  onDismissed,
}: {
  account: SuspiciousAccount;
  onDismissed: (id: string) => void;
}) {
  const [busy, setBusy] = useState<"strike" | "ban" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initials = getInitials(account.full_name, account.username);
  const color = avatarColor(account.id);

  async function handle(action: "strike" | "ban" | "dismiss") {
    setBusy(action);
    setError(null);
    try {
      if (action === "strike") await strikeUser(account.id);
      else if (action === "ban") await banUser(account.id, "Flagged by suspicious-account scorer");
      else await dismissSuspiciousAccount(account.id);
      if (action === "dismiss" || action === "ban") onDismissed(account.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm transition hover:border-zinc-700 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${color}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-zinc-50">
              {account.full_name ?? account.username ?? "Unknown user"}
            </p>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{account.email ?? "No email on record"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {account.signals.map((s, i) => (
                <span
                  key={i}
                  className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-400"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums leading-none text-zinc-50">{account.score}</p>
            <p className="text-[10px] text-zinc-500">risk score</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${LEVEL_BADGE[account.level]}`}>
            {account.level}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={() => handle("dismiss")}
          disabled={busy !== null}
          className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
        </button>
        <button
          onClick={() => handle("strike")}
          disabled={busy !== null}
          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:border-amber-500/50 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {busy === "strike" ? "Striking…" : "Strike"}
        </button>
        <button
          onClick={() => handle("ban")}
          disabled={busy !== null}
          className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-50"
        >
          {busy === "ban" ? "Banning…" : "Ban"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error}</p>
      )}
    </div>
  );
}

export default function SuspiciousAccountsPage() {
  const [accounts, setAccounts] = useState<SuspiciousAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelTab, setLevelTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchSuspiciousAccounts()
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleDismissed(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  const high = accounts.filter((a) => a.level === "High");
  const medium = accounts.filter((a) => a.level === "Medium");
  const low = accounts.filter((a) => a.level === "Low");

  const filtered =
    levelTab === "high" ? high :
    levelTab === "medium" ? medium :
    levelTab === "low" ? low :
    accounts;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = [
    { title: "Total flagged", value: loading ? "—" : String(accounts.length), change: accounts.length === 0 ? "none" : "active", tone: "slate" as const },
    { title: "High risk", value: loading ? "—" : String(high.length), change: "review now", tone: "rose" as const },
    { title: "Medium risk", value: loading ? "—" : String(medium.length), change: "worth a look", tone: "amber" as const },
    { title: "Low risk", value: loading ? "—" : String(low.length), change: "monitor", tone: "slate" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-400">Trust</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Suspicious accounts</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Rule-based signals for bot-like and multi-accounting behavior — device sharing, posting bursts,
          duplicate content, and incomplete profiles with heavy activity. Nothing here auto-bans; review the
          triggered signals and act, or dismiss if it&apos;s a false positive.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatsCard key={s.title} {...s} />
        ))}
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <Tabs
          tabs={[
            { id: "all", label: "All", count: loading ? undefined : accounts.length, color: "blue" },
            { id: "high", label: "High", count: loading ? undefined : high.length, color: "rose" },
            { id: "medium", label: "Medium", count: loading ? undefined : medium.length, color: "amber" },
            { id: "low", label: "Low", count: loading ? undefined : low.length, color: "blue" },
          ]}
          defaultTab="all"
          variant="pills"
          size="sm"
          onChange={(id) => {
            setLevelTab(id);
            setCurrentPage(1);
          }}
        />

        <div className="mt-6 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          ) : paginated.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
              No suspicious accounts in this category
            </div>
          ) : (
            paginated.map((account) => (
              <AccountCard key={account.id} account={account} onDismissed={handleDismissed} />
            ))
          )}
        </div>

        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      </div>
    </div>
  );
}
