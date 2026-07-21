"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { RoleSummary, WorkflowStepAdmin } from "@/lib/workflow-admin-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const stepSchema = z.object({
  name: z.string().min(1),
  order: z.coerce.number().int().min(1).optional(),
  responsibleRoleId: z.string().min(1),
  slaHours: z.coerce.number().int().min(1),
  isOptional: z.boolean(),
  requiresLgpd: z.boolean(),
});

type StepFormInput = z.input<typeof stepSchema>;
type StepFormOutput = z.output<typeof stepSchema>;

type StepFormDialogProps = {
  definitionId: string;
  roles: RoleSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
} & ({ mode: "create"; step?: undefined } | { mode: "edit"; step: WorkflowStepAdmin });

export function StepFormDialog({
  definitionId,
  roles,
  mode,
  step,
  open,
  onOpenChange,
  onSaved,
}: StepFormDialogProps) {
  const t = useTranslations("AdminWorkflow");
  const api = useApi();

  const defaultValues: StepFormInput = step
    ? {
        name: step.name,
        order: step.order,
        responsibleRoleId: step.responsibleRoleId,
        slaHours: step.slaHours,
        isOptional: step.isOptional,
        requiresLgpd: step.requiresLgpd,
      }
    : {
        name: "",
        responsibleRoleId: roles[0]?.id ?? "",
        slaHours: 24,
        isOptional: false,
        requiresLgpd: false,
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<StepFormInput, unknown, StepFormOutput>({
    resolver: zodResolver(stepSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset so quando o dialog abre
  }, [open, step, reset]);

  async function onSubmit(values: StepFormOutput) {
    try {
      if (step) {
        await api.patch(`/workflow/admin/steps/${step.id}`, values);
      } else {
        await api.post(`/workflow/admin/definitions/${definitionId}/steps`, values);
      }
      toast.success(step ? t("step.updateSuccess") : t("step.createSuccess"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("step.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("step.createTitle") : t("step.editTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="step-name">{t("step.fieldName")}</Label>
            <Input id="step-name" {...register("name")} aria-invalid={!!errors.name} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="step-role">{t("step.fieldResponsibleRole")}</Label>
            <Controller
              control={control}
              name="responsibleRoleId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="step-role" aria-invalid={!!errors.responsibleRoleId}>
                    <SelectValue placeholder={t("step.fieldResponsibleRolePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {roles.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("step.noRolesAvailable")}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="step-order">{t("step.fieldOrder")}</Label>
              <Input id="step-order" type="number" min={1} {...register("order")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="step-slaHours">{t("step.fieldSlaHours")}</Label>
              <Input id="step-slaHours" type="number" min={1} {...register("slaHours")} />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isOptional"
                render={({ field }) => (
                  <Checkbox
                    id="step-isOptional"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="step-isOptional" className="font-normal">
                {t("step.fieldIsOptional")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="requiresLgpd"
                render={({ field }) => (
                  <Checkbox
                    id="step-requiresLgpd"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="step-requiresLgpd" className="font-normal">
                {t("step.fieldRequiresLgpd")}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || roles.length === 0}>
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
