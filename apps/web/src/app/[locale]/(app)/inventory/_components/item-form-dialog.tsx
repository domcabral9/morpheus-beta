"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { Area } from "@/lib/assessment-types";
import type { UserOption } from "@/lib/user-picker-types";
import {
  SOFTWARE_TYPES,
  DATA_CLASSIFICATIONS,
  INVENTORY_STATUSES,
  type InventoryItemDetail,
  type InventoryItemFormValues,
} from "@/lib/inventory-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const itemFormSchema = z.object({
  name: z.string().min(1),
  vendor: z.string().min(1),
  version: z.string().optional(),
  url: z.string().optional(),
  category: z.string().min(1),
  type: z.enum(SOFTWARE_TYPES),
  hostingProvider: z.string().optional(),
  areaId: z.string().min(1),
  managerId: z.string().min(1),
  technicalResponsibleId: z.string().min(1),
  homologationDate: z.string().min(1),
  nextReviewDate: z.string().min(1),
  criticality: z.enum(CRITICALITY_VALUES),
  dataClassification: z.enum(DATA_CLASSIFICATIONS),
  status: z.enum(INVENTORY_STATUSES).optional(),
});

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function toIsoDate(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

type ItemFormDialogProps = {
  areas: Area[];
  users: UserOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: InventoryItemDetail) => void;
} & ({ mode: "create"; item?: undefined } | { mode: "edit"; item: InventoryItemDetail });

export function ItemFormDialog({ mode, item, areas, users, open, onOpenChange, onSaved }: ItemFormDialogProps) {
  const t = useTranslations("Inventory");
  const criticalityT = useTranslations("Criticality");
  const api = useApi();

  const defaultValues: InventoryItemFormValues = item
    ? {
        name: item.name,
        vendor: item.vendor,
        version: item.version ?? "",
        url: item.url ?? "",
        category: item.category,
        type: item.type,
        hostingProvider: item.hostingProvider ?? "",
        areaId: item.area.id,
        managerId: item.manager.id,
        technicalResponsibleId: item.technicalResponsible.id,
        homologationDate: toDateInputValue(item.homologationDate),
        nextReviewDate: toDateInputValue(item.nextReviewDate),
        criticality: item.criticality,
        dataClassification: item.dataClassification,
        status: item.status,
      }
    : {
        name: "",
        vendor: "",
        version: "",
        url: "",
        category: "",
        type: "SAAS",
        hostingProvider: "",
        areaId: "",
        managerId: "",
        technicalResponsibleId: "",
        homologationDate: "",
        nextReviewDate: "",
        criticality: "MEDIUM",
        dataClassification: "INTERNAL",
      };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<InventoryItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so precisa resetar quando o dialog abre, nao a cada render do defaultValues recem calculado
  }, [open, item, reset]);

  async function onSubmit(values: InventoryItemFormValues) {
    const payload = {
      ...values,
      homologationDate: toIsoDate(values.homologationDate),
      nextReviewDate: toIsoDate(values.nextReviewDate),
      version: values.version || undefined,
      url: values.url || undefined,
      hostingProvider: values.hostingProvider || undefined,
    };

    try {
      const saved = item
        ? await api.patch<InventoryItemDetail>(`/inventory/${item.id}`, payload)
        : await api.post<InventoryItemDetail>("/inventory", payload);
      toast.success(mode === "create" ? t("createSuccess") : t("updateSuccess"));
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
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
              <Label htmlFor="vendor">{t("fieldVendor")}</Label>
              <Input id="vendor" {...register("vendor")} aria-invalid={!!errors.vendor} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="version">{t("fieldVersion")}</Label>
              <Input id="version" {...register("version")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="url">{t("fieldUrl")}</Label>
              <Input id="url" {...register("url")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">{t("fieldCategory")}</Label>
              <Input id="category" {...register("category")} aria-invalid={!!errors.category} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">{t("fieldType")}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOFTWARE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`types.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hostingProvider">{t("fieldHostingProvider")}</Label>
              <Input id="hostingProvider" {...register("hostingProvider")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="areaId">{t("fieldArea")}</Label>
              <Controller
                control={control}
                name="areaId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="areaId" aria-invalid={!!errors.areaId}>
                      <SelectValue placeholder={t("fieldAreaPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="managerId">{t("fieldManagerId")}</Label>
              <Controller
                control={control}
                name="managerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="managerId" aria-invalid={!!errors.managerId}>
                      <SelectValue placeholder={t("fieldUserPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="technicalResponsibleId">{t("fieldTechnicalResponsibleId")}</Label>
              <Controller
                control={control}
                name="technicalResponsibleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="technicalResponsibleId" aria-invalid={!!errors.technicalResponsibleId}>
                      <SelectValue placeholder={t("fieldUserPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="homologationDate">{t("fieldHomologationDate")}</Label>
              <Input
                id="homologationDate"
                type="date"
                {...register("homologationDate")}
                aria-invalid={!!errors.homologationDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nextReviewDate">{t("fieldNextReviewDate")}</Label>
              <Input
                id="nextReviewDate"
                type="date"
                {...register("nextReviewDate")}
                aria-invalid={!!errors.nextReviewDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="criticality">{t("fieldCriticality")}</Label>
              <Controller
                control={control}
                name="criticality"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="criticality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
              <Label htmlFor="dataClassification">{t("fieldDataClassification")}</Label>
              <Controller
                control={control}
                name="dataClassification"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="dataClassification">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_CLASSIFICATIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`dataClassifications.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {mode === "edit" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">{t("fieldStatus")}</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVENTORY_STATUSES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`statuses.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
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
