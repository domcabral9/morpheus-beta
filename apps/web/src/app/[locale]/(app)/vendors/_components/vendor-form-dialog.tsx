"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { VendorDetail, VendorFormValues } from "@/lib/vendor-types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const NONE_VALUE = "__none__";

const vendorFormSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contractReference: z.string().optional(),
  notes: z.string().optional(),
  businessCriticality: z.enum(CRITICALITY_VALUES).optional(),
  isActive: z.boolean().optional(),
});

type VendorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (vendor: VendorDetail) => void;
} & ({ mode: "create"; vendor?: undefined } | { mode: "edit"; vendor: VendorDetail });

export function VendorFormDialog({ mode, vendor, open, onOpenChange, onSaved }: VendorDialogProps) {
  const t = useTranslations("Vendors");
  const criticalityT = useTranslations("Criticality");
  const api = useApi();

  const defaultValues: VendorFormValues = vendor
    ? {
        name: vendor.name,
        legalName: vendor.legalName ?? "",
        taxId: vendor.taxId ?? "",
        contactName: vendor.contactName ?? "",
        contactEmail: vendor.contactEmail ?? "",
        contractReference: vendor.contractReference ?? "",
        notes: vendor.notes ?? "",
        businessCriticality: vendor.businessCriticality ?? undefined,
        isActive: vendor.isActive,
      }
    : { name: "", legalName: "", taxId: "", contactName: "", contactEmail: "", contractReference: "", notes: "" };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset so quando o dialog abre
  }, [open, vendor, reset]);

  async function onSubmit(values: VendorFormValues) {
    const payload = {
      ...values,
      legalName: values.legalName || undefined,
      taxId: values.taxId || undefined,
      contactName: values.contactName || undefined,
      contactEmail: values.contactEmail || undefined,
      contractReference: values.contractReference || undefined,
      notes: values.notes || undefined,
    };
    try {
      const saved = vendor
        ? await api.patch<VendorDetail>(`/vendors/${vendor.id}`, payload)
        : await api.post<VendorDetail>("/vendors", payload);
      toast.success(mode === "create" ? t("createSuccess") : t("updateSuccess"));
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("createTitle") : t("editTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("fieldName")}</Label>
              <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="legalName">{t("fieldLegalName")}</Label>
              <Input id="legalName" {...register("legalName")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="taxId">{t("fieldTaxId")}</Label>
              <Input id="taxId" {...register("taxId")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="businessCriticality">{t("fieldBusinessCriticality")}</Label>
              <Controller
                control={control}
                name="businessCriticality"
                render={({ field }) => (
                  <Select
                    value={field.value ?? NONE_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === NONE_VALUE ? undefined : value)
                    }
                  >
                    <SelectTrigger id="businessCriticality">
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="contactName">{t("fieldContactName")}</Label>
              <Input id="contactName" {...register("contactName")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contactEmail">{t("fieldContactEmail")}</Label>
              <Input id="contactEmail" type="email" {...register("contactEmail")} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="contractReference">{t("fieldContractReference")}</Label>
              <Input id="contractReference" {...register("contractReference")} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">{t("fieldNotes")}</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          {mode === "edit" && (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isActive"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <Label htmlFor="isActive" className="font-normal">
                    {t("fieldIsActive")}
                  </Label>
                </div>
              )}
            />
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
