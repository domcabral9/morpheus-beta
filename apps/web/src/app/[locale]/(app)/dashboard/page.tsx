"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssessmentStatus, PaginatedAssessments } from "@/lib/assessment-types";

const ALL_VALUE = "__all__";
const STATUS_VALUES: AssessmentStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "PENDING_ADJUSTMENT",
  "APPROVED",
  "REJECTED",
  "REOPENED",
  "PENDING_RENEWAL",
];

export default function DashboardPage() {
  const t = useTranslations("Assessments");
  const dashboardT = useTranslations("Dashboard");
  const criticalityT = useTranslations("Criticality");
  const statusT = useTranslations("Status");
  const user = useRequireAuth();
  const api = useApi();

  const [status, setStatus] = React.useState(ALL_VALUE);
  const [data, setData] = React.useState<PaginatedAssessments | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    const params = status === ALL_VALUE ? "" : `?status=${status}`;
    api
      .get<PaginatedAssessments>(`/assessments${params}`)
      .then(setData)
      .catch(() => setError(t("loadError")));
  }, [user, api, t, status]);

  if (!user) return null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {dashboardT("welcome", { name: user.name })}
        </h1>
      </div>

      <Card>
        <CardHeader className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("title")}</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t("filterStatusAll")}</SelectItem>
                {STATUS_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusT(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild size="sm">
              <Link href="/assessments/new">
                <Plus />
                {t("newButton")}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!error && !data && (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          )}

          {data && data.items.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          )}

          {data && data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">{t("columnSoftware")}</th>
                    <th className="hidden py-2 pr-4 font-medium md:table-cell">
                      {t("columnArea")}
                    </th>
                    <th className="hidden py-2 pr-4 font-medium sm:table-cell">
                      {t("columnCriticality")}
                    </th>
                    <th className="py-2 pr-4 font-medium">{t("columnStatus")}</th>
                    <th className="hidden py-2 pr-4 font-medium md:table-cell">
                      {t("columnCreatedAt")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((assessment) => (
                    <tr key={assessment.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/assessments/${assessment.id}`}
                          className="font-medium hover:underline"
                        >
                          {assessment.softwareName}
                        </Link>
                      </td>
                      <td className="hidden py-2 pr-4 text-muted-foreground md:table-cell">
                        {assessment.area.name}
                      </td>
                      <td className="hidden py-2 pr-4 text-muted-foreground sm:table-cell">
                        {criticalityT(assessment.criticality)}
                      </td>
                      <td className="py-2 pr-4">
                        <AssessmentStatusBadge status={assessment.status} />
                      </td>
                      <td className="hidden py-2 pr-4 text-muted-foreground md:table-cell">
                        {new Date(assessment.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
