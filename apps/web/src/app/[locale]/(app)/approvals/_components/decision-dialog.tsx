"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { InboxStepExecution, WorkflowDecision } from "@/lib/workflow-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const DECISIONS: WorkflowDecision[] = ["APPROVE", "REJECT", "REQUEST_ADJUSTMENT", "SKIP"];

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_ADJUSTMENT", "SKIP"]),
  comments: z.string().optional(),
});

type DecisionFormValues = z.infer<typeof decisionSchema>;

interface DecisionDialogProps {
  execution: InboxStepExecution | null;
  onOpenChange: (open: boolean) => void;
  onDecided: (executionId: string) => void;
}

export function DecisionDialog({ execution, onOpenChange, onDecided }: DecisionDialogProps) {
  const t = useTranslations("Approvals");
  const criticalityT = useTranslations("Criticality");
  const api = useApi();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: "APPROVE", comments: "" },
  });

  React.useEffect(() => {
    if (execution) reset({ decision: "APPROVE", comments: "" });
  }, [execution, reset]);

  if (!execution) return null;

  async function onSubmit(values: DecisionFormValues) {
    if (!execution) return;
    try {
      await api.post(`/workflow/steps/${execution.id}/decide`, {
        decision: values.decision,
        comments: values.comments || undefined,
      });
      toast.success(t("decisionSuccess"));
      onDecided(execution.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("decisionError"));
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{execution.assessmentWorkflowInstance.assessment.softwareName}</DialogTitle>
          <DialogDescription>
            {t("dialogSubtitle", {
              step: execution.workflowStep.name,
              criticality: criticalityT(execution.assessmentWorkflowInstance.assessment.criticality),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t("vendorLabel")}: </span>
            {execution.assessmentWorkflowInstance.assessment.vendor}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-2">
              {t("hasRiskAnalysis")}
              <Badge
                variant={
                  execution.assessmentWorkflowInstance.assessment.hasRiskAnalysis
                    ? "success"
                    : "destructive"
                }
              >
                {execution.assessmentWorkflowInstance.assessment.hasRiskAnalysis
                  ? t("yes")
                  : t("no")}
              </Badge>
            </span>
            <span className="flex items-center gap-2">
              {t("hasInfoSecClause")}
              <Badge
                variant={
                  execution.assessmentWorkflowInstance.assessment.hasInfoSecClause
                    ? "success"
                    : "destructive"
                }
              >
                {execution.assessmentWorkflowInstance.assessment.hasInfoSecClause
                  ? t("yes")
                  : t("no")}
              </Badge>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t("vendorComplianceReminder")}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>{t("decisionLabel")}</Label>
            <Controller
              control={control}
              name="decision"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange}>
                  {DECISIONS.map((decision) => {
                    const disabled = decision === "SKIP" && !execution.workflowStep.isOptional;
                    return (
                      <div key={decision} className="flex items-center gap-2">
                        <RadioGroupItem value={decision} id={decision} disabled={disabled} />
                        <Label
                          htmlFor={decision}
                          className={disabled ? "font-normal text-muted-foreground" : "font-normal"}
                        >
                          {t(`decisions.${decision}`)}
                          {disabled && ` (${t("skipDisabled")})`}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="comments">{t("commentsLabel")}</Label>
            <Textarea id="comments" rows={3} {...register("comments")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
