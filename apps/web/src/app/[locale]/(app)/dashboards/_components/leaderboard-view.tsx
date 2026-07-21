"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { useApi } from "@/lib/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { AreaLeaderboardEntry } from "@/lib/dashboard-types";

const LEVEL_VARIANT: Record<string, "success" | "default" | "secondary" | "outline"> = {
  Referência: "success",
  Avançado: "default",
  Intermediário: "secondary",
  Iniciante: "outline",
};

export function LeaderboardView() {
  const t = useTranslations("Dashboards");
  const api = useApi();

  const [data, setData] = React.useState<AreaLeaderboardEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<AreaLeaderboardEntry[]>("/dashboards/leaderboard")
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("charts.leaderboard")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ChartContainer
              config={{ compositeScore: { label: t("leaderboard.compositeScore") } }}
              className="h-80"
            >
              <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 5]} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="areaName"
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                <Bar
                  dataKey="compositeScore"
                  radius={4}
                  maxBarSize={28}
                  fill="var(--chart-1)"
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("leaderboard.detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t("leaderboard.columnArea")}</th>
                  <th className="py-2 pr-4 font-medium">{t("leaderboard.columnLevel")}</th>
                  <th className="hidden py-2 pr-4 font-medium sm:table-cell">
                    {t("leaderboard.columnVolume")}
                  </th>
                  <th className="hidden py-2 pr-4 font-medium md:table-cell">
                    {t("leaderboard.columnQuality")}
                  </th>
                  <th className="hidden py-2 pr-4 font-medium md:table-cell">
                    {t("leaderboard.columnApprovalRate")}
                  </th>
                  <th className="py-2 pr-4 font-medium">{t("leaderboard.compositeScore")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.areaId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{entry.areaName}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={LEVEL_VARIANT[entry.level] ?? "outline"}>{entry.level}</Badge>
                    </td>
                    <td className="hidden py-2 pr-4 text-muted-foreground sm:table-cell">
                      {entry.volume}
                    </td>
                    <td className="hidden py-2 pr-4 text-muted-foreground md:table-cell">
                      {entry.qualityScore.toFixed(2)}
                    </td>
                    <td className="hidden py-2 pr-4 text-muted-foreground md:table-cell">
                      {Math.round(entry.approvalRate * 100)}%
                    </td>
                    <td className="py-2 pr-4 font-medium tabular-nums">
                      {entry.compositeScore.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
