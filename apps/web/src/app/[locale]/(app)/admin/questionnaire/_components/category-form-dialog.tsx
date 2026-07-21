"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { QuestionCategoryAdmin } from "@/lib/questionnaire-admin-types";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  order: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

type CategoryFormInput = z.input<typeof categorySchema>;
type CategoryFormOutput = z.output<typeof categorySchema>;

type CategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (category: QuestionCategoryAdmin) => void;
} & ({ mode: "create"; category?: undefined } | { mode: "edit"; category: QuestionCategoryAdmin });

export function CategoryFormDialog({ mode, category, open, onOpenChange, onSaved }: CategoryDialogProps) {
  const t = useTranslations("AdminQuestionnaire");
  const api = useApi();

  const defaultValues: CategoryFormInput = category
    ? {
        name: category.name,
        description: category.description ?? "",
        order: category.order,
        isActive: category.isActive,
      }
    : { name: "", description: "", order: 0, isActive: true };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<CategoryFormInput, unknown, CategoryFormOutput>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset so quando o dialog abre
  }, [open, category, reset]);

  async function onSubmit(values: CategoryFormOutput) {
    const payload = { ...values, description: values.description || undefined };
    try {
      const saved = category
        ? await api.patch<QuestionCategoryAdmin>(`/questionnaire/admin/categories/${category.id}`, payload)
        : await api.post<QuestionCategoryAdmin>("/questionnaire/admin/categories", payload);
      toast.success(category ? t("category.updateSuccess") : t("category.createSuccess"));
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("category.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("category.createTitle") : t("category.editTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-name">{t("category.fieldName")}</Label>
            <Input id="cat-name" {...register("name")} aria-invalid={!!errors.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-description">{t("category.fieldDescription")}</Label>
            <Textarea id="cat-description" rows={2} {...register("description")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-order">{t("category.fieldOrder")}</Label>
            <Input id="cat-order" type="number" {...register("order")} />
          </div>
          {mode === "edit" && (
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Checkbox id="cat-active" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="cat-active" className="font-normal">
                {t("category.fieldIsActive")}
              </Label>
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
