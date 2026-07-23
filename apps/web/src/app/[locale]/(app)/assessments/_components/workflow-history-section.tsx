"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkflowInstanceDetail, WorkflowStepStatus } from "@/lib/workflow-types";

const STATUS_VARIANT: Record<WorkflowStepStatus, "secondary" | "success" | "destructive" | "outline" | "warning"> = {
  PENDING: "secondary",
  IN_PROGRESS: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
  ADJUSTMENT_REQUESTED: "warning",
  SKIPPED: "outline",
};

/** Histórico de decisões do workflow de uma avaliação - reaproveita
 * `GET /workflow/assessments/:assessmentId`, que já existia no backend mas
 * nunca tinha um consumidor no frontend. Único lugar do app (fora do PDF do
 * parecer técnico) onde o comentário de uma decisão fica visível depois que
 * a etapa é fechada. */
export function WorkflowHistorySection({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("AssessmentDetail");
  const api = useApi();

  const [instance, setInstance] = React.useState<WorkflowInstanceDetail | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    api
      .get<WorkflowInstanceDetail>(`/workflow/assessments/${assessmentId}`)
      .then(setInstance)
      .catch(() => setNotFound(true));
  }, [api, assessmentId]);

  if (notFound) return null;
  if (!instance) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (instance.stepExecutions.length === 0) return null;

  const steps = [...instance.stepExecutions].sort((a, b) => a.workflowStep.order - b.workflowStep.order);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("workflowHistoryTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col gap-1 border-b pb-4 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{step.workflowStep.name}</span>
              <Badge variant={STATUS_VARIANT[step.status]}>
                {t(`workflowStepStatuses.${step.status}`)}
              </Badge>
            </div>
            {step.decidedBy && step.decidedAt && (
              <p className="text-sm text-muted-foreground">
                {t("workflowHistoryDecidedBy", {
                  name: step.decidedBy.name,
                  date: new Date(step.decidedAt).toLocaleString(),
                })}
              </p>
            )}
            {step.comments && <p className="text-sm">{step.comments}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
