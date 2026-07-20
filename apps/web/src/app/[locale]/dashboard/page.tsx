"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { AppHeader } from "@/components/app-header";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaginatedAssessments } from "@/lib/assessment-types";

export default function DashboardPage() {
  const t = useTranslations("Assessments");
  const dashboardT = useTranslations("Dashboard");
  const user = useRequireAuth();
  const api = useApi();

  const [data, setData] = React.useState<PaginatedAssessments | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    api
      .get<PaginatedAssessments>("/assessments")
      .then(setData)
      .catch(() => setError(t("loadError")));
  }, [user, api, t]);

  if (!user) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />

      <section className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {dashboardT("welcome", { name: user.name })}
          </h1>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("title")}</CardTitle>
            <Button asChild size="sm">
              <Link href="/assessments/new">
                <Plus />
                {t("newButton")}
              </Link>
            </Button>
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
                      <th className="py-2 pr-4 font-medium">{t("columnArea")}</th>
                      <th className="py-2 pr-4 font-medium">{t("columnCriticality")}</th>
                      <th className="py-2 pr-4 font-medium">{t("columnStatus")}</th>
                      <th className="py-2 pr-4 font-medium">{t("columnCreatedAt")}</th>
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
                        <td className="py-2 pr-4 text-muted-foreground">{assessment.area.name}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{assessment.criticality}</td>
                        <td className="py-2 pr-4">
                          <AssessmentStatusBadge status={assessment.status} />
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
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
      </section>
    </main>
  );
}
