"use client";

import { useState, useEffect } from "react";
import { Tabs } from "@/components/dashboard/Tabs";
import { Pagination } from "@/components/ui/Pagination";
import {
  fetchAuditLogs,
  fetchAuditLogCounts,
  type AuditCategory,
  type AuditLogEntry,
} from "./actions";

const AUDIT_PAGE_SIZE = 5;

const ACTION_LABELS: Record<string, string> = {
  ban_user: "User banned",
  unban_user: "User unbanned",
  strike_user: "Moderation strike added",
  ban_device: "Device banned",
  unban_device: "Device unbanned",
  auto_hide_post: "Post auto-hidden (mass-reported)",
  auto_suspend_user: "User auto-suspended (mass-reported)",
  restore_post: "Auto-hidden post restored",
};

function actionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action
      .split("_")
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(" ")
  );
}

const typeColors: Record<AuditCategory, string> = {
  moderation: "bg-amber-500/15 text-amber-300",
  admin: "bg-blue-500/15 text-blue-300",
  system: "bg-zinc-800 text-zinc-400",
  security: "bg-rose-500/15 text-rose-300",
};

const typeIcons: Record<AuditCategory, string> = {
  moderation: "⚑",
  admin: "◉",
  security: "⚙",
  system: "◌",
};

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LogRow({ log }: { log: AuditLogEntry }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4 transition hover:border-zinc-700">
      <span className="mt-0.5 text-lg text-zinc-500">{typeIcons[log.category]}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-zinc-50">{actionLabel(log.action)}</p>
        <p className="mt-0.5 text-sm text-zinc-400">
          {log.detail ?? "—"}
        </p>
        {log.actor_label && (
          <p className="mt-0.5 text-xs text-zinc-500">by {log.actor_label}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${typeColors[log.category]}`}>
          {log.category}
        </span>
        <span className="whitespace-nowrap text-xs text-zinc-500">{formatTimestamp(log.created_at)}</span>
      </div>
    </div>
  );
}

function LogRowSkeleton() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4">
      <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-zinc-700" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-700" />
        <div className="h-3 w-64 animate-pulse rounded bg-zinc-700" />
      </div>
      <div className="h-5 w-20 shrink-0 animate-pulse rounded-full bg-zinc-700" />
    </div>
  );
}

const TABS: { id: string; label: string; color: "blue" | "amber" | "rose" | "violet" }[] = [
  { id: "all", label: "All events", color: "blue" },
  { id: "moderation", label: "Moderation", color: "amber" },
  { id: "admin", label: "Admin", color: "blue" },
  { id: "security", label: "Security", color: "rose" },
  { id: "system", label: "System", color: "violet" },
];

export default function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const category = activeTab === "all" ? undefined : (activeTab as AuditCategory);
  const totalPages = Math.max(1, Math.ceil(totalCount / AUDIT_PAGE_SIZE));

  useEffect(() => {
    fetchAuditLogCounts()
      .then(setCounts)
      .catch(() => setCounts(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAuditLogs(1, category)
      .then(({ logs, totalCount }) => {
        setLogs(logs);
        setTotalCount(totalCount);
        setCurrentPage(1);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeTab]);

  function goToPage(page: number) {
    setLoading(true);
    fetchAuditLogs(page, category)
      .then(({ logs, totalCount }) => {
        setLogs(logs);
        setTotalCount(totalCount);
        setCurrentPage(page);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Audit logs
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Administrative history</h2>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <Tabs
          tabs={TABS.map((t) => ({
            ...t,
            count: counts ? counts[t.id] : undefined,
          }))}
          defaultTab="all"
          variant="pills"
          size="sm"
          onChange={handleTabChange}
        />

        {error && (
          <p className="mt-6 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{error}</p>
        )}

        {!error && (
          <div className="mt-6 space-y-2">
            {loading && logs.length === 0 ? (
              Array.from({ length: AUDIT_PAGE_SIZE }).map((_, i) => <LogRowSkeleton key={i} />)
            ) : logs.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No audit events found
              </div>
            ) : (
              logs.map((log) => <LogRow key={log.id} log={log} />)
            )}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          totalItems={totalCount}
          pageSize={AUDIT_PAGE_SIZE}
        />
      </div>
    </div>
  );
}
