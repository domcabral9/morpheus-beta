"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { RiskLevel } from "@/lib/risk-matrix-admin-types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const levelSchema = z.object({
  label: z.string().min(1),
  order: z.coerce.number().int().optional(),
  minScore: z.coerce.number().min(0),
  maxScore: z.coerce.number().min(0),
});

type LevelFormInput = z.input<typeof levelSchema>;
type LevelFormOutput = z.output<typeof levelSchema>;

export type LevelAxis = "probability" | "impact";

type LevelFormDialogProps = {
  axis: LevelAxis;
  configId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
} & ({ mode: "create"; level?: undefined } | { mode: "edit"; level: RiskLevel });

const AXIS_PATH: Record<LevelAxis, string> = {
  probability: "probability-levels",
  impact: "impact-levels",
};

export function LevelFormDialog({
  axis,
  configId,
  mode,
  level,
  open,
  onOpenChange,
  onSaved,
}: LevelFormDialogProps) {
  const t = useTranslations("AdminRiskMatrix");
  const api = useApi();

  const defaultValues: LevelFormInput = level
    ? { label: level.label, order: level.order, minScore: Number(level.minScore), maxScore: Number(level.maxScore) }
    : { label: "", order: 0, minScore: 0, maxScore: 1 };

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<LevelFormInput, unknown, LevelFormOutput>({
    resolver: zodResolver(levelSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset so quando o dialog abre
  }, [open, level, reset]);

  async function onSubmit(values: LevelFormOutput) {
    try {
      if (level) {
        await api.patch(`/risk-matrix/admin/${AXIS_PATH[axis]}/${level.id}`, values);
      } else {
        await api.post(`/risk-matrix/admin/configs/${configId}/${AXIS_PATH[axis]}`, values);
      }
      toast.success(level ? t("level.updateSuccess") : t("level.createSuccess"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("level.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? t(axis === "probability" ? "probabilityLevels.createTitle" : "impactLevels.createTitle")
              : t(axis === "probability" ? "probabilityLevels.editTitle" : "impactLevels.editTitle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lvl-label">{t("level.fieldLabel")}</Label>
            <Input id="lvl-label" {...register("label")} aria-invalid={!!errors.label} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lvl-order">{t("level.fieldOrder")}</Label>
              <Input id="lvl-order" type="number" {...register("order")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lvl-minScore">{t("level.fieldMinScore")}</Label>
              <Input id="lvl-minScore" type="number" step="0.01" {...register("minScore")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lvl-maxScore">{t("level.fieldMaxScore")}</Label>
              <Input id="lvl-maxScore" type="number" step="0.01" {...register("maxScore")} />
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
