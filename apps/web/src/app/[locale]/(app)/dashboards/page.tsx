"use client";

import { useTranslations } from "next-intl";

import { useRequireAuth } from "@/lib/use-require-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserDashboardView } from "./_components/user-dashboard-view";
import { AdminDashboardView } from "./_components/admin-dashboard-view";
import { ExecutiveDashboardView } from "./_components/executive-dashboard-view";
import { LeaderboardView } from "./_components/leaderboard-view";

const ADMIN_PERMISSION = "assessments:view-all";

export default function DashboardsPage() {
  const t = useTranslations("Dashboards");
  const user = useRequireAuth();

  if (!user) return null;

  const canViewTenantWide = user.permissions.includes(ADMIN_PERMISSION);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="me">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="me">{t("tabs.me")}</TabsTrigger>
          {canViewTenantWide && <TabsTrigger value="admin">{t("tabs.admin")}</TabsTrigger>}
          {canViewTenantWide && (
            <TabsTrigger value="executive">{t("tabs.executive")}</TabsTrigger>
          )}
          <TabsTrigger value="leaderboard">{t("tabs.leaderboard")}</TabsTrigger>
        </TabsList>

        <TabsContent value="me">
          <UserDashboardView />
        </TabsContent>
        {canViewTenantWide && (
          <TabsContent value="admin">
            <AdminDashboardView />
          </TabsContent>
        )}
        {canViewTenantWide && (
          <TabsContent value="executive">
            <ExecutiveDashboardView />
          </TabsContent>
        )}
        <TabsContent value="leaderboard">
          <LeaderboardView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
