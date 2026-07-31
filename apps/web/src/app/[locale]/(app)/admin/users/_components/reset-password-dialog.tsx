"use client";

import { useTranslations } from "next-intl";

import type { UserAdmin } from "@/lib/users-admin-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SetPasswordForm } from "./set-password-form";

interface ResetPasswordDialogProps {
  user: UserAdmin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ user, open, onOpenChange }: ResetPasswordDialogProps) {
  const t = useTranslations("AdminUsers");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("resetPasswordDialogTitle", { name: user.name })}</DialogTitle>
        </DialogHeader>
        <SetPasswordForm userId={user.id} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
