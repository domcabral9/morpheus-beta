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
import type { PlatformPasswordPolicy } from "@/lib/platform-policy-types";
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

function PlatformPolicyContent() {
  const t = useTranslations("AdminPlatformPolicy");
  const api = useApi();

  const [policy, setPolicy] = React.useState<PlatformPasswordPolicy | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<PlatformPasswordPolicy>("/platform/password-policy")
      .then((result) => {
        setPolicy(result);
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

      {!error && !policy && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {policy && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("cardTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordPolicyForm policy={policy} onSaved={setPolicy} />
          </CardContent>
        </Card>
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
