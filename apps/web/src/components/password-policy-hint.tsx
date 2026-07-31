"use client";

import { useTranslations } from "next-intl";
import type { PlatformPasswordPolicy } from "@/lib/platform-policy-types";

/** Resumo compacto das regras vigentes - reusado em todo lugar que uma senha é definida/trocada. */
export function PasswordPolicyHint({ policy }: { policy: PlatformPasswordPolicy | null }) {
  const t = useTranslations("PasswordPolicyHint");
  if (!policy) return null;

  const rules = [t("minLength", { count: policy.minLength })];
  if (policy.requireUppercase) rules.push(t("uppercase"));
  if (policy.requireLowercase) rules.push(t("lowercase"));
  if (policy.requireDigit) rules.push(t("digit"));
  if (policy.requireSymbol) rules.push(t("symbol"));

  return <p className="text-xs text-muted-foreground">{rules.join(" · ")}</p>;
}
