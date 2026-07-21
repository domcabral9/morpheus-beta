"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { useApi } from "@/lib/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { AdminDashboard } from "@/lib/dashboard-types";
import { colorForOutcomeKey } from "@/lib/dashboard-colors";
import { STATUS_ORDER } from "./status-order";

export function AdminDashboardView() {
  const t = useTranslations("Dashboards");
  const statusT = useTranslations("Status");
  const api = useApi();

  const [data, setData] = React.useState<AdminDashboard | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.get<AdminDashboard>("/dashboards/admin").then(setData).catch(() => setError(t("loadError")));
  }, [api, t]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const total = Object.values(data.assessmentsByStatus).reduce((sum, n) => sum + n, 0);
  const statusChartData = STATUS_ORDER.filter((status) => data.assessmentsByStatus[status]).map(
    (status) => ({
      status,
      label: statusT(status),
      count: data.assessmentsByStatus[status],
    }),
  );
  const pendingChartData = [...data.pendingByStep].sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label={t("stats.tenantTotal")} value={total} />
        <StatTile
          label={t("stats.slaBreaches")}
          value={data.slaBreaches}
          status={data.slaBreaches > 0 ? "critical" : "good"}
          hint={data.slaBreaches > 0 ? t("stats.slaBreachesHint") : undefined}
        />
        <StatTile
          label={t("stats.pendingSteps")}
          value={pendingChartData.reduce((sum, row) => sum + row.count, 0)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("charts.tenantStatusDistribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          {statusChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ChartContainer config={{}} className="h-64">
              <BarChart data={statusChartData} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" radius={4} maxBarSize={28}>
                  {statusChartData.map((entry) => (
                    <Cell key={entry.status} fill={colorForOutcomeKey(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("charts.pendingByStep")}</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ChartContainer config={{ count: { label: t("charts.pendingByStep") } }} className="h-64">
              <BarChart data={pendingChartData} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="stepName"
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" radius={4} maxBarSize={28} fill="var(--chart-1)" />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
