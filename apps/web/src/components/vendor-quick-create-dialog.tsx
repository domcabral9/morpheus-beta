"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { VendorDetail } from "@/lib/vendor-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const NONE_VALUE = "__none__";

const quickCreateSchema = z.object({
  name: z.string().min(1),
  businessCriticality: z.enum(CRITICALITY_VALUES).optional(),
});

type QuickCreateFormValues = z.infer<typeof quickCreateSchema>;

/** Cadastro mínimo, aberto de dentro do combobox de fornecedor (decisão de
 * escopo 2026-07-30): só os campos indispensáveis pra classificar o
 * fornecedor sem tirar o analista do formulário de Assessment. Cadastro
 * completo (CNPJ, contato, contrato) fica pra tela dedicada `/vendors`. */
export function VendorQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (vendor: VendorDetail) => void;
}) {
  const t = useTranslations("Vendors");
  const criticalityT = useTranslations("Criticality");
  const api = useApi();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<QuickCreateFormValues>({
    resolver: zodResolver(quickCreateSchema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    if (open) reset({ name: "" });
  }, [open, reset]);

  async function onSubmit(values: QuickCreateFormValues) {
    try {
      const created = await api.post<VendorDetail>("/vendors", values);
      toast.success(t("createSuccess"));
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("quickCreateTitle")}</DialogTitle>
          <DialogDescription>{t("quickCreateDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="qc-name">{t("fieldName")}</Label>
            <Input id="qc-name" {...register("name")} aria-invalid={!!errors.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="qc-criticality">{t("fieldBusinessCriticality")}</Label>
            <Controller
              control={control}
              name="businessCriticality"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE_VALUE}
                  onValueChange={(value) => field.onChange(value === NONE_VALUE ? undefined : value)}
                >
                  <SelectTrigger id="qc-criticality">
                    <SelectValue placeholder={t("fieldBusinessCriticalityPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>{t("fieldBusinessCriticalityNone")}</SelectItem>
                    {CRITICALITY_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {criticalityT(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
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
