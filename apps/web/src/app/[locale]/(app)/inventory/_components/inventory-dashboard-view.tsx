"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { useApi } from "@/lib/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Area } from "@/lib/assessment-types";
import { SOFTWARE_TYPES, type InventoryStats } from "@/lib/inventory-types";
import { colorForCompliance, colorForCriticality, colorForInventoryStatus } from "@/lib/inventory-dashboard-colors";

const HOSTING_PROVIDER_TOP_N = 7;

interface ChartRow {
  key: string;
  label: string;
  count: number;
}

function HorizontalBarChart({
  data,
  colorFor,
  emptyLabel,
}: {
  data: ChartRow[];
  colorFor?: (key: string) => string;
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ChartContainer config={{}} className="h-64">
      <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={140} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" radius={4} maxBarSize={28} fill="var(--chart-1)">
          {colorFor && data.map((entry) => <Cell key={entry.key} fill={colorFor(entry.key)} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function InventoryDashboardView({ areas }: { areas: Area[] }) {
  const t = useTranslations("Inventory");
  const statusT = useTranslations("Inventory.statuses");
  const criticalityT = useTranslations("Criticality");
  const typeT = useTranslations("Inventory.types");
  const api = useApi();

  const [stats, setStats] = React.useState<InventoryStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.get<InventoryStats>("/inventory/stats").then(setStats).catch(() => setError(t("loadError")));
  }, [api, t]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!stats) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const areaNameById = new Map(areas.map((area) => [area.id, area.name]));

  const statusData: ChartRow[] = stats.byStatus
    .filter((row) => row._count > 0)
    .map((row) => ({ key: row.status, label: statusT(row.status), count: row._count }));

  const criticalityData: ChartRow[] = stats.byCriticality
    .filter((row) => row._count > 0)
    .map((row) => ({ key: row.criticality, label: criticalityT(row.criticality), count: row._count }));

  const typeData: ChartRow[] = SOFTWARE_TYPES.map((type) => {
    const match = stats.byType.find((row) => row.type === type);
    return { key: type, label: typeT(type), count: match?._count ?? 0 };
  }).filter((row) => row.count > 0);

  const areaData: ChartRow[] = stats.byArea
    .filter((row) => row._count > 0)
    .map((row) => ({
      key: row.areaId,
      label: areaNameById.get(row.areaId) ?? t("dashboard.unknownArea"),
      count: row._count,
    }))
    .sort((a, b) => b.count - a.count);

  const hostingProviderRows = stats.byHostingProvider
    .filter((row) => row._count > 0)
    .map((row) => ({
      key: row.hostingProvider ?? "__none__",
      label: row.hostingProvider ?? t("dashboard.noHostingProvider"),
      count: row._count,
    }))
    .sort((a, b) => b.count - a.count);
  const hostingProviderData: ChartRow[] =
    hostingProviderRows.length > HOSTING_PROVIDER_TOP_N
      ? [
          ...hostingProviderRows.slice(0, HOSTING_PROVIDER_TOP_N),
          {
            key: "__other__",
            label: t("dashboard.otherHostingProviders"),
            count: hostingProviderRows.slice(HOSTING_PROVIDER_TOP_N).reduce((sum, row) => sum + row.count, 0),
          },
        ]
      : hostingProviderRows;

  const originData: ChartRow[] = [
    { key: "HOMOLOGATED", label: t("dashboard.originHomologated"), count: stats.homologatedCount },
    { key: "MANUAL", label: t("dashboard.originManual"), count: stats.manualCount },
  ].filter((row) => row.count > 0);

  const riskAnalysisData: ChartRow[] = [
    { key: "yes", label: t("yes"), count: stats.riskAnalysisYes },
    { key: "no", label: t("no"), count: stats.riskAnalysisNo },
  ].filter((row) => row.count > 0);

  const infoSecClauseData: ChartRow[] = [
    { key: "yes", label: t("yes"), count: stats.infoSecClauseYes },
    { key: "no", label: t("no"), count: stats.infoSecClauseNo },
  ].filter((row) => row.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label={t("dashboard.totalItems")} value={stats.totalItems} />
        <StatTile
          label={t("dashboard.overdueReviews")}
          value={stats.overdueReviews}
          status={stats.overdueReviews > 0 ? "critical" : "good"}
          hint={stats.overdueReviews > 0 ? t("dashboard.overdueReviewsHint") : undefined}
        />
        <StatTile
          label={t("dashboard.dueSoonReviews")}
          value={stats.dueSoonReviews}
          status={stats.dueSoonReviews > 0 ? "warning" : "good"}
          hint={t("dashboard.dueSoonReviewsHint")}
        />
        <StatTile label={t("dashboard.homologatedCount")} value={stats.homologatedCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.byOrigin")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={originData} emptyLabel={t("empty")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.byStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={statusData} colorFor={colorForInventoryStatus} emptyLabel={t("empty")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.byCriticality")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={criticalityData} colorFor={colorForCriticality} emptyLabel={t("empty")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.byType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={typeData} emptyLabel={t("empty")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.byArea")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={areaData} emptyLabel={t("empty")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.byHostingProvider")}</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={hostingProviderData} emptyLabel={t("empty")} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.vendorComplianceTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t("hasRiskAnalysisLabel")}</p>
              <HorizontalBarChart data={riskAnalysisData} colorFor={(key) => colorForCompliance(key === "yes")} emptyLabel={t("empty")} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t("hasInfoSecClauseLabel")}</p>
              <HorizontalBarChart
                data={infoSecClauseData}
                colorFor={(key) => colorForCompliance(key === "yes")}
                emptyLabel={t("empty")}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
