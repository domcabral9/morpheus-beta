"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { VendorTierConfig } from "@/lib/vendor-tier-config-types";
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

const configSchema = z.object({ name: z.string().min(1) });

type ConfigFormInput = z.input<typeof configSchema>;
type ConfigFormOutput = z.output<typeof configSchema>;

interface ConfigCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (config: VendorTierConfig) => void;
}

export function ConfigCreateDialog({ open, onOpenChange, onCreated }: ConfigCreateDialogProps) {
  const t = useTranslations("AdminVendorTierConfig");
  const api = useApi();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<ConfigFormInput, unknown, ConfigFormOutput>({
    resolver: zodResolver(configSchema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    if (open) reset({ name: "" });
  }, [open, reset]);

  async function onSubmit(values: ConfigFormOutput) {
    try {
      const created = await api.post<VendorTierConfig>("/vendors/admin/tier-configs", values);
      toast.success(t("config.createSuccess"));
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("config.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("config.createTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cfg-name">{t("config.fieldName")}</Label>
            <Input id="cfg-name" {...register("name")} aria-invalid={!!errors.name} />
          </div>
          <p className="text-xs text-muted-foreground">{t("config.createHint")}</p>

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
