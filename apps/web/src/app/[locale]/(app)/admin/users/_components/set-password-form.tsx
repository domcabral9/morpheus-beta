"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import { usePasswordPolicy } from "@/lib/use-password-policy";
import { PasswordPolicyHint } from "@/components/password-policy-hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SetPasswordFormProps {
  userId: string;
  /** Só faz sentido logo após criar um usuário - "pular por agora" deixa o
   * usuário sem senha local (SSO-only), estado já válido hoje. */
  allowSkip?: boolean;
  onDone: () => void;
}

/** Form puro (sem Dialog próprio) - reusado tanto dentro do 2º passo de
 * `create-user-dialog.tsx` quanto dentro de `reset-password-dialog.tsx`. */
export function SetPasswordForm({ userId, allowSkip, onDone }: SetPasswordFormProps) {
  const t = useTranslations("AdminUsers");
  const api = useApi();
  const policy = usePasswordPolicy();

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api.post(`/users/${userId}/password`, { password });
      toast.success(t("setPasswordSuccess"));
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("setPasswordError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="set-password-new">{t("fieldNewPassword")}</Label>
        <Input
          id="set-password-new"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="set-password-confirm">{t("fieldConfirmPassword")}</Label>
        <Input
          id="set-password-confirm"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          aria-invalid={mismatch}
          required
        />
        {mismatch && <p className="text-xs text-destructive">{t("passwordMismatch")}</p>}
      </div>

      <PasswordPolicyHint policy={policy} />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-2 flex justify-end gap-2">
        {allowSkip && (
          <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
            {t("skipForNow")}
          </Button>
        )}
        <Button type="submit" disabled={pending || !password || mismatch}>
          {pending ? t("saving") : t("setPasswordButton")}
        </Button>
      </div>
    </form>
  );
}
