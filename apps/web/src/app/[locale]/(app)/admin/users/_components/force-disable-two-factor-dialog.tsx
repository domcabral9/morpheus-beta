"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { UserAdmin } from "@/lib/users-admin-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ForceDisableTwoFactorDialogProps {
  user: UserAdmin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisabled: (updated: UserAdmin) => void;
}

export function ForceDisableTwoFactorDialog({
  user,
  open,
  onOpenChange,
  onDisabled,
}: ForceDisableTwoFactorDialogProps) {
  const t = useTranslations("AdminUsers");
  const api = useApi();
  const [submitting, setSubmitting] = React.useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const updated = await api.post<UserAdmin>(`/users/${user.id}/force-disable-two-factor`);
      onDisabled(updated);
      onOpenChange(false);
      toast.success(t("forceDisableTwoFactorSuccess", { name: user.name }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("forceDisableTwoFactorError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("forceDisableTwoFactorTitle", { name: user.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("forceDisableTwoFactorWarning")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction disabled={submitting} onClick={handleConfirm}>
            {submitting ? t("saving") : t("forceDisableTwoFactorConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
