"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { RiskClassificationAdmin } from "@/lib/risk-matrix-admin-types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const classificationSchema = z.object({
  label: z.string().min(1),
  order: z.coerce.number().int().optional(),
  color: z.string().min(1),
  recommendationText: z.string().optional(),
  minScore: z.coerce.number().min(0),
  maxScore: z.coerce.number().min(0),
});

type ClassificationFormInput = z.input<typeof classificationSchema>;
type ClassificationFormOutput = z.output<typeof classificationSchema>;

type ClassificationFormDialogProps = {
  configId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
} & ({ mode: "create"; classification?: undefined } | { mode: "edit"; classification: RiskClassificationAdmin });

export function ClassificationFormDialog({
  configId,
  mode,
  classification,
  open,
  onOpenChange,
  onSaved,
}: ClassificationFormDialogProps) {
  const t = useTranslations("AdminRiskMatrix");
  const api = useApi();

  const defaultValues: ClassificationFormInput = classification
    ? {
        label: classification.label,
        order: classification.order,
        color: classification.color,
        recommendationText: classification.recommendationText ?? "",
        minScore: Number(classification.minScore),
        maxScore: Number(classification.maxScore),
      }
    : { label: "", order: 0, color: "#16a34a", recommendationText: "", minScore: 0, maxScore: 1 };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<ClassificationFormInput, unknown, ClassificationFormOutput>({
    resolver: zodResolver(classificationSchema),
    defaultValues,
  });

  const colorPreview = useWatch({ control, name: "color" });

  React.useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset so quando o dialog abre
  }, [open, classification, reset]);

  async function onSubmit(values: ClassificationFormOutput) {
    const payload = { ...values, recommendationText: values.recommendationText || undefined };
    try {
      if (classification) {
        await api.patch(`/risk-matrix/admin/classifications/${classification.id}`, payload);
      } else {
        await api.post(`/risk-matrix/admin/configs/${configId}/classifications`, payload);
      }
      toast.success(classification ? t("classification.updateSuccess") : t("classification.createSuccess"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("classification.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("classification.createTitle") : t("classification.editTitle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cls-label">{t("classification.fieldLabel")}</Label>
            <Input id="cls-label" {...register("label")} aria-invalid={!!errors.label} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cls-color">{t("classification.fieldColor")}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 rounded-md border border-input bg-transparent"
                {...register("color")}
              />
              <Input id="cls-color" {...register("color")} aria-invalid={!!errors.color} />
              <span
                className="size-6 shrink-0 rounded-full border"
                style={{ backgroundColor: colorPreview || "transparent" }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cls-recommendationText">{t("classification.fieldRecommendationText")}</Label>
            <Textarea id="cls-recommendationText" rows={2} {...register("recommendationText")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cls-order">{t("classification.fieldOrder")}</Label>
              <Input id="cls-order" type="number" {...register("order")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cls-minScore">{t("classification.fieldMinScore")}</Label>
              <Input id="cls-minScore" type="number" step="0.01" {...register("minScore")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cls-maxScore">{t("classification.fieldMaxScore")}</Label>
              <Input id="cls-maxScore" type="number" step="0.01" {...register("maxScore")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
