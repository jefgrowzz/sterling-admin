"use client";

import { useState } from "react";
import { Tabs } from "@/components/dashboard/Tabs";

export type ActivityItemType = {
  id: string;
  type: "report" | "user" | "moderation" | "post";
  title: string;
  detail: string;
  timestamp: string;
  severity?: "low" | "medium" | "high" | "critical";
};

type DashboardActivityTabsProps = {
  activity: ActivityItemType[];
  alerts: ActivityItemType[];
  changes: ActivityItemType[];
};

const severityDot: Record<string, string> = {
  low: "bg-zinc-600",
  medium: "bg-amber-400",
  high: "bg-rose-400",
  critical: "bg-rose-500",
};

const typeIcon: Record<string, string> = {
  report: "⚑",
  user: "◎",
  moderation: "▣",
  post: "◌",
};

function ActivityList({ items, empty }: { items: ActivityItemType[]; empty: string }) {
  if (items.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
        {empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="group flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-800/60 p-4 transition hover:border-zinc-700 hover:shadow-sm"
        >
          <span className="mt-0.5 text-base text-zinc-500">{typeIcon[item.type] ?? "◌"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-zinc-50">{item.title}</p>
              {item.severity && (
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${severityDot[item.severity] ?? "bg-zinc-700"}`} />
              )}
            </div>
            <p className="mt-0.5 text-sm text-zinc-400 line-clamp-1">{item.detail}</p>
          </div>
          <span className="shrink-0 text-xs text-zinc-500">{item.timestamp}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardActivityTabs({ activity, alerts, changes }: DashboardActivityTabsProps) {
  const [overviewTab, setOverviewTab] = useState("activity");

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-50">Recent activity</h3>
        <Tabs
          tabs={[
            { id: "activity", label: "Activity", color: "emerald" },
            { id: "alerts", label: "Alerts", count: alerts.length, color: "amber" },
            { id: "changes", label: "Changes", color: "blue" },
          ]}
          defaultTab="activity"
          variant="segmented"
          size="sm"
          onChange={(tab) => setOverviewTab(tab as "activity" | "alerts" | "changes")}
        />
      </div>
      <div className="mt-6">
        {overviewTab === "activity" && (
          <ActivityList items={activity} empty="No recent activity" />
        )}
        {overviewTab === "alerts" && (
          <ActivityList items={alerts} empty="No new alerts at this time" />
        )}
        {overviewTab === "changes" && (
          <ActivityList items={changes} empty="No recent changes to display" />
        )}
      </div>
    </div>
  );
}
