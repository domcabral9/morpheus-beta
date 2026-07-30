"use client";

import { useTranslations } from "next-intl";

import { useRequireAuth } from "@/lib/use-require-auth";
import { usePermission } from "@/lib/use-permission";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorListView } from "./_components/vendor-list-view";
import { VendorTrackingView } from "./_components/vendor-tracking-view";

export default function VendorsPage() {
  const t = useTranslations("Vendors");
  const user = useRequireAuth();
  const canManage = usePermission("vendors:manage");

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">{t("tabList")}</TabsTrigger>
          <TabsTrigger value="tracking">{t("tabTracking")}</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <VendorListView canManage={canManage} />
        </TabsContent>
        <TabsContent value="tracking">
          <VendorTrackingView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
