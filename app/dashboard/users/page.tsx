"use client";

import { useState } from "react";
import { Tabs } from "@/components/dashboard/Tabs";
import { UserManagementView } from "./UsersView";
import { CheatsView } from "./CheatsView";
import { NotificationsView } from "./NotificationsView";

type PageView = "users" | "cheats" | "notifications";

export default function UsersPage() {
  const [pageView, setPageView] = useState<PageView>("users");

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Operations</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
          {pageView === "users" ? "User management" : pageView === "cheats" ? "Engagement boosting" : "Push notifications"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          {pageView === "users"
            ? "Browse, filter, and manage user accounts across the platform."
            : pageView === "cheats"
            ? "Directly boost engagement metrics for testing or demo purposes."
            : "Broadcast a push notification or in-app message to all users."}
        </p>
        <div className="mt-5 border-t border-zinc-800 pt-5">
          <Tabs
            tabs={[
              { id: "users", label: "Users", color: "emerald" },
              { id: "cheats", label: "Cheats", color: "amber" },
              { id: "notifications", label: "Notifications", color: "violet" },
            ]}
            defaultTab="users"
            variant="segmented"
            onChange={(id) => setPageView(id as PageView)}
          />
        </div>
      </div>

      {pageView === "users" && <UserManagementView />}
      {pageView === "cheats" && <CheatsView />}
      {pageView === "notifications" && <NotificationsView />}
    </div>
  );
}
