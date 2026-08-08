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
import type {
  PlatformPasswordPolicy,
  PlatformTwoFactorPolicy,
  PlatformPasswordlessPolicy,
  PlatformIntegrationsPolicy,
} from "@/lib/platform-policy-types";
import { AdminSectionGate } from "../_components/section-gate";

const passwordPolicySchema = z.object({
  minLength: z.coerce.number().int().min(8).max(128),
  requireUppercase: z.boolean(),
  requireLowercase: z.boolean(),
  requireDigit: z.boolean(),
  requireSymbol: z.boolean(),
});

type PasswordPolicyFormInput = z.input<typeof passwordPolicySchema>;
type PasswordPolicyFormOutput = z.output<typeof passwordPolicySchema>;

const TOGGLE_FIELDS = [
  "requireUppercase",
  "requireLowercase",
  "requireDigit",
  "requireSymbol",
] as const;

function PasswordPolicyForm({
  policy,
  onSaved,
}: {
  policy: PlatformPasswordPolicy;
  onSaved: (policy: PlatformPasswordPolicy) => void;
}) {
  const t = useTranslations("AdminPlatformPolicy");
  const api = useApi();

  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<PasswordPolicyFormInput, unknown, PasswordPolicyFormOutput>({
    resolver: zodResolver(passwordPolicySchema),
    defaultValues: {
      minLength: policy.minLength,
      requireUppercase: policy.requireUppercase,
      requireLowercase: policy.requireLowercase,
      requireDigit: policy.requireDigit,
      requireSymbol: policy.requireSymbol,
    },
  });

  async function onSubmit(values: PasswordPolicyFormOutput) {
    try {
      const updated = await api.patch<PlatformPasswordPolicy>("/platform/password-policy", values);
      toast.success(t("saveSuccess"));
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="minLength">{t("fieldMinLength")}</Label>
        <Input
          id="minLength"
          type="number"
          min={8}
          max={128}
          className="max-w-32"
          aria-invalid={!!errors.minLength}
          {...register("minLength")}
        />
        {errors.minLength && <p className="text-xs text-destructive">{errors.minLength.message}</p>}
      </div>

      <div className="flex flex-col gap-3">
        {TOGGLE_FIELDS.map((field) => (
          <div key={field} className="flex items-center gap-2">
            <Controller
              control={control}
              name={field}
              render={({ field: controllerField }) => (
                <Checkbox
                  id={field}
                  checked={controllerField.value}
                  onCheckedChange={(checked) => controllerField.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor={field} className="font-normal">
              {t(`field.${field}`)}
            </Label>
          </div>
        ))}
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function TwoFactorPolicyForm({
  policy,
  onSaved,
}: {
  policy: PlatformTwoFactorPolicy;
  onSaved: (policy: PlatformTwoFactorPolicy) => void;
}) {
  const t = useTranslations("AdminPlatformPolicy");
  const api = useApi();

  const [enforced, setEnforced] = React.useState(policy.enforced);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const updated = await api.patch<PlatformTwoFactorPolicy>("/platform/two-factor-policy", {
        enforced,
      });
      toast.success(t("saveSuccess"));
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Checkbox
          id="twoFactorEnforced"
          checked={enforced}
          onCheckedChange={(checked) => setEnforced(checked === true)}
        />
        <Label htmlFor="twoFactorEnforced" className="font-normal">
          {t("twoFactorFieldEnforced")}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">{t("twoFactorEnforcedHint")}</p>

      <div>
        <Button type="submit" disabled={submitting || enforced === policy.enforced}>
          {submitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function PasswordlessPolicyForm({
  policy,
  onSaved,
}: {
  policy: PlatformPasswordlessPolicy;
  onSaved: (policy: PlatformPasswordlessPolicy) => void;
}) {
  const t = useTranslations("AdminPlatformPolicy");
  const api = useApi();

  const [enabled, setEnabled] = React.useState(policy.enabled);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const updated = await api.patch<PlatformPasswordlessPolicy>("/platform/passwordless-policy", {
        enabled,
      });
      toast.success(t("saveSuccess"));
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Checkbox
          id="passwordlessEnabled"
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked === true)}
        />
        <Label htmlFor="passwordlessEnabled" className="font-normal">
          {t("passwordlessFieldEnabled")}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">{t("passwordlessEnabledHint")}</p>

      <div>
        <Button type="submit" disabled={submitting || enabled === policy.enabled}>
          {submitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

const integrationsPolicySchema = z.object({
  virusTotalApiKey: z.string().optional(),
  virusTotalEnabled: z.boolean(),
  virusTotalDailyBudget: z.coerce.number().int().min(1).max(500),
  endoflifeEnabled: z.boolean(),
});

type IntegrationsPolicyFormInput = z.input<typeof integrationsPolicySchema>;
type IntegrationsPolicyFormOutput = z.output<typeof integrationsPolicySchema>;

function IntegrationsPolicyForm({
  policy,
  onSaved,
}: {
  policy: PlatformIntegrationsPolicy;
  onSaved: (policy: PlatformIntegrationsPolicy) => void;
}) {
  const t = useTranslations("AdminPlatformPolicy");
  const api = useApi();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<IntegrationsPolicyFormInput, unknown, IntegrationsPolicyFormOutput>({
    resolver: zodResolver(integrationsPolicySchema),
    defaultValues: {
      virusTotalApiKey: "",
      virusTotalEnabled: policy.virusTotalEnabled,
      virusTotalDailyBudget: policy.virusTotalDailyBudget,
      endoflifeEnabled: policy.endoflifeEnabled,
    },
  });

  async function onSubmit(values: IntegrationsPolicyFormOutput) {
    const payload: {
      virusTotalApiKey?: string;
      virusTotalEnabled: boolean;
      virusTotalDailyBudget: number;
      endoflifeEnabled: boolean;
    } = {
      virusTotalEnabled: values.virusTotalEnabled,
      virusTotalDailyBudget: values.virusTotalDailyBudget,
      endoflifeEnabled: values.endoflifeEnabled,
    };
    // Chave só entra no payload se o usuário digitou algo - vazio/omitido
    // preserva a chave já salva no backend (nunca sobrescreve com vazio).
    if (values.virusTotalApiKey && values.virusTotalApiKey.trim() !== "") {
      payload.virusTotalApiKey = values.virusTotalApiKey.trim();
    }

    try {
      const updated = await api.patch<PlatformIntegrationsPolicy>(
        "/platform/integrations-policy",
        payload,
      );
      toast.success(t("saveSuccess"));
      reset({
        virusTotalApiKey: "",
        virusTotalEnabled: updated.virusTotalEnabled,
        virusTotalDailyBudget: updated.virusTotalDailyBudget,
        endoflifeEnabled: updated.endoflifeEnabled,
      });
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="virusTotalApiKey">{t("integrationsFieldApiKey")}</Label>
        <Input
          id="virusTotalApiKey"
          type="password"
          autoComplete="off"
          placeholder={
            policy.hasVirusTotalApiKey
              ? t("integrationsApiKeyConfiguredPlaceholder")
              : t("integrationsApiKeyEmptyPlaceholder")
          }
          {...register("virusTotalApiKey")}
        />
        <p className="text-xs text-muted-foreground">{t("integrationsApiKeyHint")}</p>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="virusTotalEnabled"
          render={({ field }) => (
            <Checkbox
              id="virusTotalEnabled"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <Label htmlFor="virusTotalEnabled" className="font-normal">
          {t("integrationsFieldVirusTotalEnabled")}
        </Label>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="virusTotalDailyBudget">{t("integrationsFieldDailyBudget")}</Label>
        <Input
          id="virusTotalDailyBudget"
          type="number"
          min={1}
          max={500}
          className="max-w-32"
          aria-invalid={!!errors.virusTotalDailyBudget}
          {...register("virusTotalDailyBudget")}
        />
        {errors.virusTotalDailyBudget && (
          <p className="text-xs text-destructive">{errors.virusTotalDailyBudget.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="endoflifeEnabled"
          render={({ field }) => (
            <Checkbox
              id="endoflifeEnabled"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <Label htmlFor="endoflifeEnabled" className="font-normal">
          {t("integrationsFieldEndoflifeEnabled")}
        </Label>
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function PlatformPolicyContent() {
  const t = useTranslations("AdminPlatformPolicy");
  const api = useApi();

  const [policy, setPolicy] = React.useState<PlatformPasswordPolicy | null>(null);
  const [twoFactorPolicy, setTwoFactorPolicy] = React.useState<PlatformTwoFactorPolicy | null>(null);
  const [passwordlessPolicy, setPasswordlessPolicy] =
    React.useState<PlatformPasswordlessPolicy | null>(null);
  const [integrationsPolicy, setIntegrationsPolicy] =
    React.useState<PlatformIntegrationsPolicy | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      api.get<PlatformPasswordPolicy>("/platform/password-policy"),
      api.get<PlatformTwoFactorPolicy>("/platform/two-factor-policy"),
      api.get<PlatformPasswordlessPolicy>("/platform/passwordless-policy"),
      api.get<PlatformIntegrationsPolicy>("/platform/integrations-policy"),
    ])
      .then(([passwordResult, twoFactorResult, passwordlessResult, integrationsResult]) => {
        setPolicy(passwordResult);
        setTwoFactorPolicy(twoFactorResult);
        setPasswordlessPolicy(passwordlessResult);
        setIntegrationsPolicy(integrationsResult);
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

      {!error && (!policy || !twoFactorPolicy || !passwordlessPolicy || !integrationsPolicy) && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {policy && twoFactorPolicy && passwordlessPolicy && integrationsPolicy && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("cardTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PasswordPolicyForm policy={policy} onSaved={setPolicy} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("twoFactorCardTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TwoFactorPolicyForm policy={twoFactorPolicy} onSaved={setTwoFactorPolicy} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("passwordlessCardTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PasswordlessPolicyForm policy={passwordlessPolicy} onSaved={setPasswordlessPolicy} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("integrationsCardTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <IntegrationsPolicyForm policy={integrationsPolicy} onSaved={setIntegrationsPolicy} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AdminPlatformPolicyPage() {
  return (
    <AdminSectionGate permission="platform:cross-tenant">
      <PlatformPolicyContent />
    </AdminSectionGate>
  );
}
