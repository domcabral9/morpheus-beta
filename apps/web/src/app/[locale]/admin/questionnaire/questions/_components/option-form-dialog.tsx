"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { QuestionOptionAdmin } from "@/lib/questionnaire-admin-types";
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

const optionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  score: z.coerce.number().min(0),
  order: z.coerce.number().int().optional(),
});

type OptionFormInput = z.input<typeof optionSchema>;
type OptionFormOutput = z.output<typeof optionSchema>;

type OptionFormDialogProps = {
  questionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (option: QuestionOptionAdmin) => void;
} & ({ mode: "create"; option?: undefined } | { mode: "edit"; option: QuestionOptionAdmin });

export function OptionFormDialog({
  mode,
  option,
  questionId,
  open,
  onOpenChange,
  onSaved,
}: OptionFormDialogProps) {
  const t = useTranslations("AdminQuestionnaire");
  const api = useApi();

  const defaultValues: OptionFormInput = option
    ? { label: option.label, value: option.value, score: Number(option.score), order: option.order }
    : { label: "", value: "", score: 0 };

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<OptionFormInput, unknown, OptionFormOutput>({
    resolver: zodResolver(optionSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset so quando o dialog abre
  }, [open, option, reset]);

  async function onSubmit(values: OptionFormOutput) {
    try {
      const saved = option
        ? await api.patch<QuestionOptionAdmin>(`/questionnaire/admin/options/${option.id}`, values)
        : await api.post<QuestionOptionAdmin>(`/questionnaire/admin/questions/${questionId}/options`, values);
      toast.success(option ? t("question.optionUpdateSuccess") : t("question.optionCreateSuccess"));
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("question.optionSaveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? t("question.optionCreateTitle") : t("question.optionEditTitle")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="opt-label">{t("question.optionLabel")}</Label>
            <Input id="opt-label" {...register("label")} aria-invalid={!!errors.label} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="opt-value">{t("question.optionValue")}</Label>
            <Input id="opt-value" {...register("value")} aria-invalid={!!errors.value} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="opt-score">{t("question.optionScore")}</Label>
            <Input id="opt-score" type="number" step="0.01" {...register("score")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="opt-order">{t("question.optionOrder")}</Label>
            <Input id="opt-order" type="number" {...register("order")} />
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
