"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { useApi } from "@/lib/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ExecutiveDashboard } from "@/lib/dashboard-types";
import { colorForOutcomeKey } from "@/lib/dashboard-colors";

export function ExecutiveDashboardView() {
  const t = useTranslations("Dashboards");
  const api = useApi();

  const [data, setData] = React.useState<ExecutiveDashboard | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<ExecutiveDashboard>("/dashboards/executive")
      .then(setData)
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const classifications = Object.keys(data.classificationDistribution);
  const postureData = [
    Object.fromEntries([
      ["name", t("charts.compliancePosture")],
      ...classifications.map((label) => [label, data.classificationDistribution[label]]),
    ]),
  ];
  const chartConfig = Object.fromEntries(
    classifications.map((label) => [label, { label, color: colorForOutcomeKey(label) }]),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Número-herói: a taxa de aprovação é o que a diretoria pergunta primeiro. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("stats.approvalRate")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-bold tabular-nums tracking-tight text-chart-good sm:text-6xl">
            {Math.round(data.approvalRate * 100)}%
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("stats.approvalRateHint", { total: data.totalDecided })}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <StatTile label={t("stats.totalDecided")} value={data.totalDecided} />
        <StatTile label={t("stats.approved")} value={data.approved} status="good" />
        <StatTile label={t("stats.rejected")} value={data.rejected} status="critical" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("charts.compliancePosture")}</CardTitle>
        </CardHeader>
        <CardContent>
          {classifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <>
              <ChartContainer config={chartConfig} className="h-24">
                <BarChart data={postureData} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" hide />
                  <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                  {classifications.map((label) => (
                    <Bar
                      key={label}
                      dataKey={label}
                      stackId="posture"
                      fill={colorForOutcomeKey(label)}
                      radius={0}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
              <div className="mt-3 flex flex-wrap gap-4">
                {classifications.map((label) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{ background: colorForOutcomeKey(label) }}
                      aria-hidden="true"
                    />
                    {label} ({data.classificationDistribution[label]})
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
