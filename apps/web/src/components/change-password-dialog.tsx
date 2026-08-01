"use client";

import { useTranslations } from "next-intl";

import { ChangePasswordForm } from "@/components/change-password-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Wrapper fino em torno de `ChangePasswordForm` - mantido disponível como
 * modal pronto mesmo que a tela de perfil (`/profile`) tenha virado o
 * caminho principal de troca de senha a partir do menu do avatar. */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const t = useTranslations("ChangePassword");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
        </DialogHeader>
        <ChangePasswordForm onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
