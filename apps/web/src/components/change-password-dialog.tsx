"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import { usePasswordPolicy } from "@/lib/use-password-policy";
import { PasswordPolicyHint } from "@/components/password-policy-hint";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Autoatendimento - "Trocar senha" no menu do avatar. Exige confirmar a
 * senha atual; sem detecção client-side de SSO-only, o 400 do backend
 * estoura como qualquer outro erro de formulário. */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const t = useTranslations("ChangePassword");
  const api = useApi();
  const policy = usePasswordPolicy();

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api.patch("/auth/password", { currentPassword, newPassword });
      toast.success(t("changeSuccess"));
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("changeError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="change-password-current">{t("fieldCurrentPassword")}</Label>
            <Input
              id="change-password-current"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="change-password-new">{t("fieldNewPassword")}</Label>
            <Input
              id="change-password-new"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="change-password-confirm">{t("fieldConfirmPassword")}</Label>
            <Input
              id="change-password-confirm"
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
            <Button type="submit" disabled={pending || !currentPassword || !newPassword || mismatch}>
              {pending ? t("saving") : t("changeButton")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
