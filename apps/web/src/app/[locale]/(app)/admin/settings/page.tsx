"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { TenantAdmin } from "@/lib/tenant-admin-types";
import { AdminSectionGate } from "../_components/section-gate";

const settingsSchema = z.object({
  logoUrl: z.string().optional(),
  securityTeamName: z.string().optional(),
  opinionNumberPrefix: z.string().min(1),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

function SettingsForm({ tenant, onSaved }: { tenant: TenantAdmin; onSaved: (tenant: TenantAdmin) => void }) {
  const t = useTranslations("AdminSettings");
  const api = useApi();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      logoUrl: tenant.logoUrl ?? "",
      securityTeamName: tenant.securityTeamName ?? "",
      opinionNumberPrefix: tenant.opinionNumberPrefix,
    },
  });

  async function onSubmit(values: SettingsFormValues) {
    const payload = {
      ...values,
      logoUrl: values.logoUrl || undefined,
      securityTeamName: values.securityTeamName || undefined,
    };
    try {
      const updated = await api.patch<TenantAdmin>("/tenants/current", payload);
      toast.success(t("saveSuccess"));
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="logoUrl">{t("fieldLogoUrl")}</Label>
        <Input id="logoUrl" {...register("logoUrl")} placeholder="https://..." />
        <p className="text-xs text-muted-foreground">{t("fieldLogoUrlHint")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="securityTeamName">{t("fieldSecurityTeamName")}</Label>
        <Input id="securityTeamName" {...register("securityTeamName")} placeholder={t("fieldSecurityTeamNamePlaceholder")} />
        <p className="text-xs text-muted-foreground">{t("fieldSecurityTeamNameHint")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="opinionNumberPrefix">{t("fieldOpinionNumberPrefix")}</Label>
        <Input
          id="opinionNumberPrefix"
          {...register("opinionNumberPrefix")}
          aria-invalid={!!errors.opinionNumberPrefix}
        />
        <p className="text-xs text-muted-foreground">{t("fieldOpinionNumberPrefixHint")}</p>
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function SettingsContent() {
  const t = useTranslations("AdminSettings");
  const api = useApi();

  const [tenant, setTenant] = React.useState<TenantAdmin | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<TenantAdmin>("/tenants/current")
      .then((result) => {
        setTenant(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !tenant && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {tenant && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">{tenant.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm tenant={tenant} onSaved={setTenant} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <AdminSectionGate permission="system:configure">
      <SettingsContent />
    </AdminSectionGate>
  );
}
