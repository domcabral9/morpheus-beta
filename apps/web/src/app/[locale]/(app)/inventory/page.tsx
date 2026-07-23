"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { usePermission } from "@/lib/use-permission";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Area } from "@/lib/assessment-types";
import type { UserOption } from "@/lib/user-picker-types";
import { InventoryListView } from "./_components/inventory-list-view";
import { InventoryDashboardView } from "./_components/inventory-dashboard-view";

export default function InventoryPage() {
  const t = useTranslations("Inventory");
  const user = useRequireAuth();
  const api = useApi();
  const canManage = usePermission("inventory:manage");

  const [areas, setAreas] = React.useState<Area[]>([]);
  const [users, setUsers] = React.useState<UserOption[]>([]);

  React.useEffect(() => {
    if (!user) return;
    api.get<Area[]>("/areas").then(setAreas).catch(() => {});
  }, [user, api]);

  React.useEffect(() => {
    if (!user || !canManage) return;
    api.get<UserOption[]>("/users").then(setUsers).catch(() => {});
  }, [user, canManage, api]);

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="list">{t("tabs.list")}</TabsTrigger>
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <InventoryListView areas={areas} users={users} canManage={canManage} />
        </TabsContent>
        <TabsContent value="overview">
          <InventoryDashboardView areas={areas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
