"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { PendingInventoryApproval } from "@/lib/inventory-approval-types";
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

const DECISIONS = ["APPROVE", "REJECT"] as const;

const decisionSchema = z
  .object({
    decision: z.enum(DECISIONS),
    notes: z.string().optional(),
  })
  .refine((data) => data.decision !== "REJECT" || !!data.notes?.trim(), {
    message: "required",
    path: ["notes"],
  });

type DecisionFormValues = z.infer<typeof decisionSchema>;

interface InventoryDecisionDialogProps {
  item: PendingInventoryApproval | null;
  onOpenChange: (open: boolean) => void;
  onDecided: (itemId: string) => void;
}

export function InventoryDecisionDialog({ item, onOpenChange, onDecided }: InventoryDecisionDialogProps) {
  const t = useTranslations("Approvals.inventoryTab");
  const criticalityT = useTranslations("Criticality");
  const api = useApi();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: "APPROVE", notes: "" },
  });

  React.useEffect(() => {
    if (item) reset({ decision: "APPROVE", notes: "" });
  }, [item, reset]);

  if (!item) return null;

  async function onSubmit(values: DecisionFormValues) {
    if (!item) return;
    try {
      const endpoint = values.decision === "APPROVE" ? "approve" : "reject";
      await api.post(`/inventory/${item.id}/${endpoint}`, { notes: values.notes || undefined });
      toast.success(t("decisionSuccess"));
      onDecided(item.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("decisionError"));
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            {t("dialogSubtitle", {
              vendor: item.vendor,
              criticality: criticalityT(item.criticality),
              requester: item.approvalRequest?.requester.name ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

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
                      <RadioGroupItem value={decision} id={decision} />
                      <Label htmlFor={decision} className="font-normal">
                        {t(`decisions.${decision}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">{t("notesLabel")}</Label>
            <Textarea id="notes" rows={3} {...register("notes")} aria-invalid={!!errors.notes} />
            {errors.notes && <p className="text-xs text-destructive">{t("notesRequiredForReject")}</p>}
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
