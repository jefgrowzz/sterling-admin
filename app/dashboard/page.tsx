import { StatsCard } from "@/components/dashboard/StatsCard";
import { fetchDashboardMetrics } from "./lib/metrics";
import { fetchRecentActivity } from "./lib/activity";
import { DashboardActivityTabs } from "@/components/dashboard/DashboardActivityTabs";

export default async function DashboardPage() {
  const metrics = await fetchDashboardMetrics();
  let activity = { activity: [] as any[], alerts: [] as any[], changes: [] as any[] };
  try {
    activity = await fetchRecentActivity();
  } catch {
    // fetchRecentActivity can fail if tables are empty — that's fine
  }

  const stats = [
    {
      title: "Total users",
      value: metrics.activeUsers.toLocaleString(),
      change: "",
      tone: "blue" as const,
      icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z"/></svg>,
      subtitle: `${metrics.newUsersThisWeek} new this week`,
      href: "/dashboard/users",
    },
    {
      title: "Pending reports",
      value: String(metrics.pendingFlags),
      change: metrics.pendingFlags > 0 ? `${metrics.pendingFlags} active` : "clear",
      tone: metrics.pendingFlags > 0 ? "amber" as const : "emerald" as const,
      icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M3 3.5A1.5 1.5 0 014.5 2h1.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.44 4H11a3 3 0 012 2.5V8h1a1 1 0 011 1v1a1 1 0 01-1 1h-1v4a2 2 0 01-2 2H5a2 2 0 01-2-2V3.5z"/></svg>,
      href: "/dashboard/flagged-accounts",
    },
    {
      title: "Reports today",
      value: String(metrics.reportsToday),
      change: metrics.reportsToday > 0 ? "needs review" : "none",
      tone: metrics.reportsToday > 0 ? "rose" as const : "slate" as const,
      icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5.5a.75.75 0 001.5 0V5zm0 8.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/></svg>,
      href: "/dashboard/moderation",
    },
    {
      title: "Total posts",
      value: metrics.totalPosts.toLocaleString(),
      change: "",
      tone: "violet" as const,
      icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M3.196 12.87l-.825.483a.75.75 0 000 1.294l7.25 4.25a.75.75 0 00.758 0l7.25-4.25a.75.75 0 000-1.294l-.825-.484-5.666 3.322a2.25 2.25 0 01-2.276 0L3.196 12.87z"/><path d="M3.196 8.87l-.825.483a.75.75 0 000 1.294l7.25 4.25a.75.75 0 00.758 0l7.25-4.25a.75.75 0 000-1.294l-.825-.484-5.666 3.322a2.25 2.25 0 01-2.276 0L3.196 8.87z"/><path d="M10.38 1.103a.75.75 0 00-.76 0l-7.25 4.25a.75.75 0 000 1.294l7.25 4.25a.75.75 0 00.76 0l7.25-4.25a.75.75 0 000-1.294l-7.25-4.25z"/></svg>,
      subtitle: `${metrics.totalCommunities} communities`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-950/50" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-300">S</span>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Overview</p>
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
            Keep the platform safe and moving.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">
            Live metrics pulled from the database. {metrics.activeUsers > 0 ? `${metrics.activeUsers.toLocaleString()} users, ${metrics.totalPosts.toLocaleString()} posts across ${metrics.totalCommunities} communities.` : "No data yet — start populating your database."}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Activity */}
      <DashboardActivityTabs
        activity={activity.activity}
        alerts={activity.alerts}
        changes={activity.changes}
      />
    </div>
  );
}