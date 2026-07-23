"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TenantAdmin } from "@/lib/tenant-admin-types";
import { AdminSectionGate } from "../_components/section-gate";

const settingsSchema = z.object({
  securityTeamName: z.string().optional(),
  opinionNumberPrefix: z.string().min(1),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const MM_DD_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Validação condicional: as datas só precisam bater com o formato MM-DD
// quando a janela está habilitada — desabilitada, os campos podem ficar
// em branco sem travar o salvamento.
const renewalWindowSchema = z
  .object({
    annualClosingWindowEnabled: z.boolean(),
    annualClosingWindowStart: z.string().optional(),
    annualClosingWindowEnd: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.annualClosingWindowEnabled) return;
    (["annualClosingWindowStart", "annualClosingWindowEnd"] as const).forEach((field) => {
      const value = values[field];
      if (!value || !MM_DD_REGEX.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Formato MM-DD (ex.: 11-01).",
        });
      }
    });
  });

type RenewalWindowFormValues = z.infer<typeof renewalWindowSchema>;

const ALLOWED_LOGO_TYPES = "image/png,image/jpeg";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

function LogoUploader({ tenant, onUploaded }: { tenant: TenantAdmin; onUploaded: (tenant: TenantAdmin) => void }) {
  const t = useTranslations("AdminSettings");
  const api = useApi();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    // Ressincroniza o preview com a fonte da verdade (tenant.logoUrl) sempre
    // que ela mudar (upload novo, reload da página) - `tenant` é um objeto
    // novo a cada fetch, então isto não roda a cada render, só quando o logo
    // realmente muda.
    if (!tenant.logoUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      return;
    }
    // Caminho estático do Next.js (seed de demo) - renderiza direto, sem
    // passar pela API.
    if (tenant.logoUrl.startsWith("/")) {
      setPreviewUrl(tenant.logoUrl);
      return;
    }
    // Chave de storage real (upload) - precisa buscar os bytes via API.
    let objectUrl: string | null = null;
    api
      .getBlob("/tenants/current/logo")
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => setPreviewUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, tenant.logoUrl]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast.error(t("logoUploadError"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await api.postForm<TenantAdmin>("/tenants/current/logo", formData);
      toast.success(t("logoUploadSuccess"));
      onUploaded(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("logoUploadError"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{t("logoLabel")}</Label>
      <div className="flex items-center gap-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview vem de blob:/caminho estático, não do otimizador de imagens do Next.
          <img
            src={previewUrl}
            alt={t("logoPreviewAlt")}
            className="size-16 rounded-md border object-contain p-1"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-md border text-xs text-muted-foreground">
            {t("logoNoneSet")}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_LOGO_TYPES}
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? t("logoUploading") : t("logoUploadButton")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
        </div>
      </div>
    </div>
  );
}

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
      securityTeamName: tenant.securityTeamName ?? "",
      opinionNumberPrefix: tenant.opinionNumberPrefix,
    },
  });

  async function onSubmit(values: SettingsFormValues) {
    const payload = {
      ...values,
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
      <LogoUploader tenant={tenant} onUploaded={onSaved} />

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

function RenewalWindowForm({ tenant, onSaved }: { tenant: TenantAdmin; onSaved: (tenant: TenantAdmin) => void }) {
  const t = useTranslations("AdminSettings");
  const api = useApi();

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<RenewalWindowFormValues>({
    resolver: zodResolver(renewalWindowSchema),
    defaultValues: {
      annualClosingWindowEnabled: tenant.annualClosingWindowEnabled,
      annualClosingWindowStart: tenant.annualClosingWindowStart ?? "",
      annualClosingWindowEnd: tenant.annualClosingWindowEnd ?? "",
    },
  });

  const enabled = watch("annualClosingWindowEnabled");

  async function onSubmit(values: RenewalWindowFormValues) {
    const payload = {
      annualClosingWindowEnabled: values.annualClosingWindowEnabled,
      annualClosingWindowStart: values.annualClosingWindowStart || undefined,
      annualClosingWindowEnd: values.annualClosingWindowEnd || undefined,
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
      <p className="text-sm text-muted-foreground">{t("renewalWindowDescription")}</p>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="annualClosingWindowEnabled"
          render={({ field }) => (
            <Checkbox
              id="annualClosingWindowEnabled"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <Label htmlFor="annualClosingWindowEnabled" className="font-normal">
          {t("fieldRenewalWindowEnabled")}
        </Label>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="annualClosingWindowStart">{t("fieldRenewalWindowStart")}</Label>
        <Input
          id="annualClosingWindowStart"
          placeholder="MM-DD"
          disabled={!enabled}
          aria-invalid={!!errors.annualClosingWindowStart}
          {...register("annualClosingWindowStart")}
        />
        {errors.annualClosingWindowStart && (
          <p className="text-xs text-destructive">{errors.annualClosingWindowStart.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="annualClosingWindowEnd">{t("fieldRenewalWindowEnd")}</Label>
        <Input
          id="annualClosingWindowEnd"
          placeholder="MM-DD"
          disabled={!enabled}
          aria-invalid={!!errors.annualClosingWindowEnd}
          {...register("annualClosingWindowEnd")}
        />
        {errors.annualClosingWindowEnd && (
          <p className="text-xs text-destructive">{errors.annualClosingWindowEnd.message}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("fieldRenewalWindowHint")}</p>
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function SettingsTabComingSoon({ titleKey }: { titleKey: "smtp" | "sso" | "ai" }) {
  const t = useTranslations("AdminSettings");

  return (
    <div className="flex flex-col gap-2 py-4">
      <h2 className="text-base font-semibold">{t(`tabs.${titleKey}`)}</h2>
      <p className="text-sm text-muted-foreground">{t("tabs.comingSoonDescription")}</p>
    </div>
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
        <Tabs defaultValue="general">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
            <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
            <TabsTrigger value="renewalWindow">{t("tabs.renewalWindow")}</TabsTrigger>
            <TabsTrigger value="smtp">{t("tabs.smtp")}</TabsTrigger>
            <TabsTrigger value="sso">{t("tabs.sso")}</TabsTrigger>
            <TabsTrigger value="ai">{t("tabs.ai")}</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base">{tenant.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <SettingsForm tenant={tenant} onSaved={setTenant} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="renewalWindow">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base">{t("tabs.renewalWindow")}</CardTitle>
              </CardHeader>
              <CardContent>
                <RenewalWindowForm tenant={tenant} onSaved={setTenant} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="smtp">
            <SettingsTabComingSoon titleKey="smtp" />
          </TabsContent>
          <TabsContent value="sso">
            <SettingsTabComingSoon titleKey="sso" />
          </TabsContent>
          <TabsContent value="ai">
            <SettingsTabComingSoon titleKey="ai" />
          </TabsContent>
        </Tabs>
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
