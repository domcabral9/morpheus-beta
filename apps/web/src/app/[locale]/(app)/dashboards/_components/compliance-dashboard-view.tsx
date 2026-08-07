"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { useApi } from "@/lib/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ComplianceFrameworkResult } from "@/lib/dashboard-types";
import { colorForCompliancePercentage } from "@/lib/dashboard-colors";

export function ComplianceDashboardView() {
  const t = useTranslations("Dashboards");
  const api = useApi();

  const [data, setData] = React.useState<ComplianceFrameworkResult[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [frameworkCode, setFrameworkCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<ComplianceFrameworkResult[]>("/dashboards/compliance")
      .then((frameworks) => {
        setData(frameworks);
        setFrameworkCode((current) => current ?? frameworks[0]?.frameworkCode ?? null);
      })
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

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  const totalControls = data.reduce((sum, fw) => sum + fw.totalControlsCount, 0);
  const evaluatedControls = data.reduce((sum, fw) => sum + fw.evaluatedControlsCount, 0);
  const evaluatedPercentages = data
    .flatMap((fw) => fw.controls)
    .filter((control) => control.metPercentage !== null)
    .map((control) => control.metPercentage as number);
  const overallPosture =
    evaluatedPercentages.length > 0
      ? evaluatedPercentages.reduce((sum, pct) => sum + pct, 0) / evaluatedPercentages.length
      : null;

  const selectedFramework = data.find((fw) => fw.frameworkCode === frameworkCode) ?? data[0]!;
  const evaluatedInFramework = selectedFramework.controls
    .filter((control) => control.metPercentage !== null)
    .sort((a, b) => (b.metPercentage as number) - (a.metPercentage as number));
  const neverEvaluatedInFramework = selectedFramework.controls.filter(
    (control) => control.metPercentage === null,
  );

  const chartData = evaluatedInFramework.map((control) => ({
    ...control,
    percentage: Math.round((control.metPercentage as number) * 100),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("compliance.overallPostureLabel")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="text-5xl font-bold tabular-nums tracking-tight sm:text-6xl"
            style={{
              color:
                overallPosture === null
                  ? "var(--muted-foreground)"
                  : colorForCompliancePercentage(overallPosture),
            }}
          >
            {overallPosture === null ? "—" : `${Math.round(overallPosture * 100)}%`}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("compliance.overallPostureHint", {
              evaluated: evaluatedControls,
              total: totalControls,
            })}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <StatTile label={t("stats.controlsInCatalog")} value={totalControls} />
        <StatTile label={t("stats.controlsEvaluated")} value={evaluatedControls} />
      </div>

      <div className="flex flex-col gap-2 sm:w-72">
        <label htmlFor="compliance-framework" className="text-sm font-medium">
          {t("filters.framework")}
        </label>
        <Select value={selectedFramework.frameworkCode} onValueChange={setFrameworkCode}>
          <SelectTrigger id="compliance-framework">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.map((fw) => (
              <SelectItem key={fw.frameworkCode} value={fw.frameworkCode}>
                {fw.frameworkName} ({fw.evaluatedControlsCount}/{fw.totalControlsCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{selectedFramework.frameworkName}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("compliance.noneEvaluated")}</p>
          ) : (
            <ChartContainer
              config={{ percentage: { label: t("compliance.percentageLabel") } }}
              className="w-full"
              style={{ height: Math.max(220, chartData.length * 34) }}
            >
              <BarChart data={chartData} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="code"
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="percentage" radius={4} maxBarSize={22}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.controlId}
                      fill={colorForCompliancePercentage(entry.metPercentage)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}

          {neverEvaluatedInFramework.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {t("compliance.neverEvaluatedLabel", { count: neverEvaluatedInFramework.length })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("compliance.detailTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{t("compliance.columnCode")}</th>
                  <th className="py-2 pr-4 font-medium">{t("compliance.columnTitle")}</th>
                  <th className="py-2 pr-4 font-medium">{t("compliance.columnSubjects")}</th>
                  <th className="py-2 pr-4 font-medium">{t("compliance.columnPercentage")}</th>
                </tr>
              </thead>
              <tbody>
                {selectedFramework.controls.map((control) => (
                  <tr key={control.controlId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium tabular-nums">{control.code}</td>
                    <td className="py-2 pr-4">{control.title}</td>
                    <td className="py-2 pr-4 text-muted-foreground tabular-nums">
                      {control.totalCount > 0
                        ? `${control.metCount}/${control.totalCount}`
                        : t("compliance.notEvaluated")}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="inline-flex items-center gap-1.5 font-medium tabular-nums"
                        style={{ color: colorForCompliancePercentage(control.metPercentage) }}
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            background: colorForCompliancePercentage(control.metPercentage),
                          }}
                          aria-hidden="true"
                        />
                        {control.metPercentage === null
                          ? "—"
                          : `${Math.round(control.metPercentage * 100)}%`}
                      </span>
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
