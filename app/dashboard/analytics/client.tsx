"use client";

import { useState } from "react";
import { Tabs } from "@/components/dashboard/Tabs";
import { BarChart, HorizontalBar } from "@/components/ui/BarChart";
import type { RoleDistribution, CategoryBreakdown, TimeSeriesPoint } from "../lib/analytics";

type AnalyticsClientProps = {
  roleDistribution: RoleDistribution[];
  categoryBreakdown: CategoryBreakdown[];
  reportTrend: TimeSeriesPoint[];
  userTrend: TimeSeriesPoint[];
  postTrend: TimeSeriesPoint[];
  eventTrend: TimeSeriesPoint[];
  statusCounts: Record<string, number>;
  postTypeEntries: [string, number][];
  marketEntries: [string, number][];
  communityCategoryEntries: [string, number][];
  eventTypeEntries: [string, number][];
  totalUsers: number;
  totalReports: number;
  totalPosts: number;
  totalCommunities: number;
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  privateEvents: number;
  publicEvents: number;
};

const trendColors: Record<string, string> = {
  reports: "rgb(245 158 11 / 0.8)",
  users: "rgb(59 130 246 / 0.8)",
  posts: "rgb(139 92 246 / 0.8)",
  events: "rgb(244 63 94 / 0.8)",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-400",
  reviewed: "bg-blue-400",
  actioned: "bg-emerald-400",
  dismissed: "bg-zinc-600",
  resolved: "bg-emerald-400",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  actioned: "Actioned",
  dismissed: "Dismissed",
  resolved: "Resolved",
};

export function AnalyticsClient(props: AnalyticsClientProps) {
  const [trendTab, setTrendTab] = useState("reports");

  const trendData =
    trendTab === "reports" ? props.reportTrend :
    trendTab === "users" ? props.userTrend :
    trendTab === "posts" ? props.postTrend :
    props.eventTrend;

  return (
    <div className="space-y-6">
      {/* Row 1: User roles + Report categories */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* User role distribution */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-50">User roles</h3>
              <p className="mt-0.5 text-sm text-zinc-400">
                {props.totalUsers.toLocaleString()} total users
              </p>
            </div>
          </div>
          <div className="mt-6">
            <HorizontalBar data={props.roleDistribution} />
          </div>
        </div>

        {/* Report category breakdown */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-50">Report categories</h3>
              <p className="mt-0.5 text-sm text-zinc-400">
                {props.totalReports.toLocaleString()} total reports
              </p>
            </div>
          </div>
          {props.categoryBreakdown.length > 0 ? (
            <div className="mt-6">
              <HorizontalBar data={props.categoryBreakdown} />
            </div>
          ) : (
            <div className="mt-6 flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
              No reports filed yet
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Weekly trends + Report status */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        {/* Weekly trend chart */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-50">7-day trend</h3>
              <p className="mt-0.5 text-sm text-zinc-400">
                {trendTab === "reports" ? "Reports per day" :
                 trendTab === "users" ? "New users per day" :
                 trendTab === "posts" ? "Posts per day" :
                 "Events created per day"}
              </p>
            </div>
            <Tabs
              tabs={[
                { id: "reports", label: "Reports", color: "amber" },
                { id: "users", label: "Users", color: "blue" },
                { id: "posts", label: "Posts", color: "violet" },
                { id: "events", label: "Events", color: "rose" },
              ]}
              defaultTab="reports"
              variant="segmented"
              size="sm"
              onChange={setTrendTab}
            />
          </div>
          <div className="mt-6" style={{ height: 200 }}>
            {trendData.some((d) => d.value > 0) ? (
              <BarChart
                data={trendData}
                color={trendColors[trendTab] ?? "rgb(100 116 139 / 0.8)"}
                height={200}
                showValues
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No data this week
              </div>
            )}
          </div>
        </div>

        {/* Report status breakdown */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-50">Report status</h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            {props.totalReports.toLocaleString()} total
          </p>
          <div className="mt-6 space-y-3">
            {Object.entries(props.statusCounts).length > 0 ? (
              Object.entries(props.statusCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const pct = props.totalReports > 0
                    ? Math.round((count / props.totalReports) * 100)
                    : 0;
                  return (
                    <div key={status} className="flex items-center justify-between rounded-xl bg-zinc-800/60 px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusColors[status] ?? "bg-zinc-600"}`} />
                        <span className="text-sm font-medium text-zinc-300 capitalize">
                          {statusLabels[status] ?? status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-zinc-50">{count.toLocaleString()}</span>
                        <span className="w-10 text-right text-xs text-zinc-500">{pct}%</span>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No reports yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Post types + Markets + Communities + Event types */}
      <div className="grid gap-6 xl:grid-cols-4">
        {/* Post types */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-50">Post types</h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            {props.totalPosts.toLocaleString()} total
          </p>
          <div className="mt-6 space-y-2.5">
            {props.postTypeEntries.length > 0 ? (
              props.postTypeEntries.map(([type, count]) => {
                const pct = props.totalPosts > 0
                  ? Math.round((count / props.totalPosts) * 100)
                  : 0;
                return (
                  <div key={type} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-zinc-800">
                    <span className="text-sm font-medium text-zinc-300 capitalize">{type}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-200">{count.toLocaleString()}</span>
                      <span className="w-10 text-right text-xs text-zinc-500">{pct}%</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No posts yet
              </div>
            )}
          </div>
        </div>

        {/* Markets */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-50">Markets</h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            User operating markets
          </p>
          <div className="mt-6 space-y-2.5">
            {props.marketEntries.length > 0 ? (
              props.marketEntries.slice(0, 10).map(([market, count]) => {
                const pct = props.totalUsers > 0
                  ? Math.round((count / props.totalUsers) * 100)
                  : 0;
                return (
                  <div key={market} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-zinc-800">
                    <span className="text-sm font-medium text-zinc-300">{market}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-200">{count.toLocaleString()}</span>
                      <span className="w-10 text-right text-xs text-zinc-500">{pct}%</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No market data
              </div>
            )}
          </div>
        </div>

        {/* Community categories */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-50">Communities</h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            {props.totalCommunities.toLocaleString()} total
          </p>
          <div className="mt-6 space-y-2.5">
            {props.communityCategoryEntries.length > 0 ? (
              props.communityCategoryEntries.map(([cat, count]) => {
                const pct = props.totalCommunities > 0
                  ? Math.round((count / props.totalCommunities) * 100)
                  : 0;
                return (
                  <div key={cat} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-zinc-800">
                    <span className="text-sm font-medium text-zinc-300 capitalize">{cat}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-200">{count.toLocaleString()}</span>
                      <span className="w-10 text-right text-xs text-zinc-500">{pct}%</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No communities yet
              </div>
            )}
          </div>
        </div>

        {/* Event types */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-50">Event types</h3>
          <p className="mt-0.5 text-sm text-zinc-400">
            {props.totalEvents.toLocaleString()} total
          </p>
          <div className="mt-6 space-y-2.5">
            {props.eventTypeEntries.length > 0 ? (
              props.eventTypeEntries.map(([type, count]) => {
                const pct = props.totalEvents > 0
                  ? Math.round((count / props.totalEvents) * 100)
                  : 0;
                return (
                  <div key={type} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-zinc-800">
                    <span className="text-sm font-medium text-zinc-300 capitalize">{type.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-200">{count.toLocaleString()}</span>
                      <span className="w-10 text-right text-xs text-zinc-500">{pct}%</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-800/60 text-sm text-zinc-500">
                No events yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Events overview */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-50">Events overview</h3>
        <p className="mt-0.5 text-sm text-zinc-400">
          Timing and visibility split across all events
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Upcoming", value: props.upcomingEvents, dot: "bg-emerald-400" },
            { label: "Past", value: props.pastEvents, dot: "bg-zinc-600" },
            { label: "Public", value: props.publicEvents, dot: "bg-blue-400" },
            { label: "Private", value: props.privateEvents, dot: "bg-violet-400" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl bg-zinc-800/60 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                <span className="text-sm font-medium text-zinc-300">{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-zinc-50">{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}