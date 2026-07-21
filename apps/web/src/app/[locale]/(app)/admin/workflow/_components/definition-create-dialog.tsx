"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { WorkflowDefinitionAdmin } from "@/lib/workflow-admin-types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const definitionSchema = z.object({
  name: z.string().min(1),
  isDefault: z.boolean(),
});

type DefinitionFormInput = z.input<typeof definitionSchema>;
type DefinitionFormOutput = z.output<typeof definitionSchema>;

interface DefinitionCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (definition: WorkflowDefinitionAdmin) => void;
}

export function DefinitionCreateDialog({ open, onOpenChange, onCreated }: DefinitionCreateDialogProps) {
  const t = useTranslations("AdminWorkflow");
  const api = useApi();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<DefinitionFormInput, unknown, DefinitionFormOutput>({
    resolver: zodResolver(definitionSchema),
    defaultValues: { name: "", isDefault: false },
  });

  React.useEffect(() => {
    if (open) reset({ name: "", isDefault: false });
  }, [open, reset]);

  async function onSubmit(values: DefinitionFormOutput) {
    try {
      const created = await api.post<WorkflowDefinitionAdmin>("/workflow/admin/definitions", values);
      toast.success(t("definition.createSuccess"));
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("definition.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("definition.createTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="def-name">{t("definition.fieldName")}</Label>
            <Input id="def-name" {...register("name")} aria-invalid={!!errors.name} />
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="isDefault"
              render={({ field }) => (
                <Checkbox id="def-isDefault" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="def-isDefault" className="font-normal">
              {t("definition.fieldIsDefault")}
            </Label>
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
