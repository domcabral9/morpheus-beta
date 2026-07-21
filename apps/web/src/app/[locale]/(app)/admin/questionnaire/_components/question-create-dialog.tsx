"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import { CHOICE_TYPES, QUESTION_TYPES, RISK_DIMENSIONS, type QuestionAdmin } from "@/lib/questionnaire-admin-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const optionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  score: z.coerce.number().min(0),
});

const questionCreateSchema = z.object({
  text: z.string().min(1),
  description: z.string().optional(),
  weight: z.coerce.number().min(0),
  type: z.enum(QUESTION_TYPES),
  riskDimension: z.enum(RISK_DIMENSIONS),
  isRequired: z.boolean(),
  options: z.array(optionSchema),
});

type QuestionCreateFormInput = z.input<typeof questionCreateSchema>;
type QuestionCreateFormOutput = z.output<typeof questionCreateSchema>;

interface QuestionCreateDialogProps {
  categoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (question: QuestionAdmin) => void;
}

export function QuestionCreateDialog({
  categoryId,
  open,
  onOpenChange,
  onCreated,
}: QuestionCreateDialogProps) {
  const t = useTranslations("AdminQuestionnaire");
  const api = useApi();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<QuestionCreateFormInput, unknown, QuestionCreateFormOutput>({
    resolver: zodResolver(questionCreateSchema),
    defaultValues: {
      text: "",
      description: "",
      weight: 1,
      type: "SINGLE_CHOICE",
      riskDimension: "PROBABILITY",
      isRequired: true,
      options: [{ label: "", value: "", score: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "options" });
  const type = useWatch({ control, name: "type" });
  const needsOptions = CHOICE_TYPES.has(type);

  React.useEffect(() => {
    if (open) {
      reset({
        text: "",
        description: "",
        weight: 1,
        type: "SINGLE_CHOICE",
        riskDimension: "PROBABILITY",
        isRequired: true,
        options: [{ label: "", value: "", score: 0 }],
      });
    }
  }, [open, reset]);

  async function onSubmit(values: QuestionCreateFormOutput) {
    if (needsOptions && values.options.length === 0) {
      toast.error(t("question.optionsRequired"));
      return;
    }
    try {
      const created = await api.post<QuestionAdmin>("/questionnaire/admin/questions", {
        categoryId,
        text: values.text,
        description: values.description || undefined,
        weight: values.weight,
        type: values.type,
        riskDimension: values.riskDimension,
        isRequired: values.isRequired,
        options: needsOptions ? values.options : undefined,
      });
      toast.success(t("question.createSuccess"));
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("question.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("question.createTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="q-text">{t("question.fieldText")}</Label>
            <Textarea id="q-text" rows={2} {...register("text")} aria-invalid={!!errors.text} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="q-description">{t("question.fieldDescription")}</Label>
            <Textarea id="q-description" rows={2} {...register("description")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="q-weight">{t("question.fieldWeight")}</Label>
              <Input id="q-weight" type="number" step="0.01" {...register("weight")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="q-type">{t("question.fieldType")}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="q-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`question.types.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="q-riskDimension">{t("question.fieldRiskDimension")}</Label>
              <Controller
                control={control}
                name="riskDimension"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="q-riskDimension">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RISK_DIMENSIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`question.riskDimensions.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Controller
                control={control}
                name="isRequired"
                render={({ field }) => (
                  <input
                    id="q-required"
                    type="checkbox"
                    className="size-4"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                )}
              />
              <Label htmlFor="q-required" className="font-normal">
                {t("question.fieldIsRequired")}
              </Label>
            </div>
          </div>

          {needsOptions && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>{t("question.optionsTitle")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ label: "", value: "", score: 0 })}
                >
                  <Plus />
                  {t("question.addOption")}
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_1fr_5rem_auto] items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`option-${index}-label`} className="text-xs">
                      {t("question.optionLabel")}
                    </Label>
                    <Input id={`option-${index}-label`} {...register(`options.${index}.label`)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`option-${index}-value`} className="text-xs">
                      {t("question.optionValue")}
                    </Label>
                    <Input id={`option-${index}-value`} {...register(`options.${index}.value`)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`option-${index}-score`} className="text-xs">
                      {t("question.optionScore")}
                    </Label>
                    <Input
                      id={`option-${index}-score`}
                      type="number"
                      step="0.01"
                      {...register(`options.${index}.score`)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

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
