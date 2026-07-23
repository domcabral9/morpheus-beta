"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { BulkDecideResult, InboxStepExecution, WorkflowDecision } from "@/lib/workflow-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface BulkDecisionDialogProps {
  executions: InboxStepExecution[];
  onOpenChange: (open: boolean) => void;
  onDecided: (results: BulkDecideResult[]) => void;
}

export function BulkDecisionDialog({ executions, onOpenChange, onDecided }: BulkDecisionDialogProps) {
  const t = useTranslations("Approvals");
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
    if (executions.length > 0) reset({ decision: "APPROVE", comments: "" });
  }, [executions, reset]);

  if (executions.length === 0) return null;

  async function onSubmit(values: DecisionFormValues) {
    try {
      const results = await api.post<BulkDecideResult[]>("/workflow/steps/bulk-decide", {
        stepExecutionIds: executions.map((execution) => execution.id),
        decision: values.decision,
        comments: values.comments || undefined,
      });
      const successCount = results.filter((result) => result.success).length;
      const failureCount = results.length - successCount;
      if (failureCount === 0) {
        toast.success(t("bulkDecisionSuccess", { count: successCount }));
      } else {
        toast.warning(t("bulkDecisionPartial", { successCount, failureCount }));
      }
      onDecided(results);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("decisionError"));
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("bulkDialogTitle", { count: executions.length })}</DialogTitle>
          <DialogDescription>{t("bulkDialogSubtitle")}</DialogDescription>
        </DialogHeader>

        <ul className="max-h-32 list-disc overflow-y-auto pl-5 text-sm text-muted-foreground">
          {executions.map((execution) => (
            <li key={execution.id}>
              {execution.assessmentWorkflowInstance.assessment.softwareName} — {execution.workflowStep.name}
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>{t("decisionLabel")}</Label>
            <Controller
              control={control}
              name="decision"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange}>
                  {DECISIONS.map((decision) => (
                    <div key={decision} className="flex items-center gap-2">
                      <RadioGroupItem value={decision} id={`bulk-${decision}`} />
                      <Label htmlFor={`bulk-${decision}`} className="font-normal">
                        {t(`decisions.${decision}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
            <p className="text-xs text-muted-foreground">{t("bulkSkipHint")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-comments">{t("commentsLabel")}</Label>
            <Textarea id="bulk-comments" rows={3} {...register("comments")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("submitting") : t("bulkSubmit", { count: executions.length })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
