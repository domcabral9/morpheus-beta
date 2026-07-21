"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { AssessmentStatus } from "@/lib/assessment-types";
import type { UserDashboard } from "@/lib/dashboard-types";
import { colorForOutcomeKey } from "@/lib/dashboard-colors";
import { STATUS_ORDER } from "./status-order";

export function UserDashboardView() {
  const t = useTranslations("Dashboards");
  const statusT = useTranslations("Status");
  const api = useApi();

  const [data, setData] = React.useState<UserDashboard | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.get<UserDashboard>("/dashboards/me").then(setData).catch(() => setError(t("loadError")));
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
  const chartData = STATUS_ORDER.filter((status) => data.assessmentsByStatus[status]).map(
    (status) => ({
      status,
      label: statusT(status),
      count: data.assessmentsByStatus[status],
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label={t("stats.total")} value={total} />
        <StatTile
          label={statusT("APPROVED")}
          value={data.assessmentsByStatus.APPROVED ?? 0}
          status="good"
        />
        <StatTile
          label={statusT("PENDING_ADJUSTMENT")}
          value={data.assessmentsByStatus.PENDING_ADJUSTMENT ?? 0}
          status="warning"
        />
        <StatTile
          label={statusT("REJECTED")}
          value={data.assessmentsByStatus.REJECTED ?? 0}
          status="critical"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("charts.myStatusDistribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ChartContainer config={{}} className="h-64">
              <BarChart data={chartData} layout="vertical" margin={{ left: 12 }}>
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
                  {chartData.map((entry) => (
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
          <CardTitle className="text-base">{t("recentAssessments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentAssessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {data.recentAssessments.map((assessment) => (
                <li
                  key={assessment.id}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <Link
                    href={`/assessments/${assessment.id}`}
                    className="font-medium hover:underline"
                  >
                    {assessment.softwareName}
                  </Link>
                  <AssessmentStatusBadge status={assessment.status as AssessmentStatus} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
