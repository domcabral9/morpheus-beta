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

function PlatformPolicyContent() {
  const t = useTranslations("AdminPlatformPolicy");
  const api = useApi();

  const [policy, setPolicy] = React.useState<PlatformPasswordPolicy | null>(null);
  const [twoFactorPolicy, setTwoFactorPolicy] = React.useState<PlatformTwoFactorPolicy | null>(null);
  const [passwordlessPolicy, setPasswordlessPolicy] =
    React.useState<PlatformPasswordlessPolicy | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      api.get<PlatformPasswordPolicy>("/platform/password-policy"),
      api.get<PlatformTwoFactorPolicy>("/platform/two-factor-policy"),
      api.get<PlatformPasswordlessPolicy>("/platform/passwordless-policy"),
    ])
      .then(([passwordResult, twoFactorResult, passwordlessResult]) => {
        setPolicy(passwordResult);
        setTwoFactorPolicy(twoFactorResult);
        setPasswordlessPolicy(passwordlessResult);
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

      {!error && (!policy || !twoFactorPolicy || !passwordlessPolicy) && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {policy && twoFactorPolicy && passwordlessPolicy && (
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
