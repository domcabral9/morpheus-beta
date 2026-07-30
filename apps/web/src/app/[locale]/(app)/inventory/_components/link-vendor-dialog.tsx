"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/components/auth-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VendorCombobox, type VendorComboboxValue } from "@/components/vendor-combobox";

interface LinkVendorDialogProps {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Vincula um Vendor real ao item de inventário e já inicia a ART na mesma
 * ação (decisão confirmada com o usuário: vincular + iniciar é um fluxo só,
 * não duas etapas). Diferente do combobox em "Nova avaliação", aqui o
 * fallback de texto livre não serve pra nada - iniciar uma VendorAssessment
 * exige um Vendor real, então esse caso só mostra um aviso. */
export function LinkVendorDialog({ itemId, open, onOpenChange }: LinkVendorDialogProps) {
  const t = useTranslations("Inventory");
  const api = useApi();
  const router = useRouter();

  const [value, setValue] = React.useState<VendorComboboxValue>({ vendorName: "" });
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setValue({ vendorName: "" }), 0);
    return () => clearTimeout(timer);
  }, [open]);

  async function handleChange(next: VendorComboboxValue) {
    setValue(next);
    if (!next.vendorId) {
      toast.error(t("linkVendorNeedsRealVendor"));
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/inventory/${itemId}`, { vendorId: next.vendorId, vendor: next.vendorName });
      const created = await api.post<{ id: string }>(`/vendors/${next.vendorId}/assessments`, {});
      onOpenChange(false);
      router.push(`/vendors/${next.vendorId}/assessments/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("linkVendorError"));
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("linkVendorTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("linkVendorHint")}</p>
        <VendorCombobox value={value} onChange={handleChange} />
        {submitting && <p className="text-xs text-muted-foreground">{t("linkVendorStarting")}</p>}
      </DialogContent>
    </Dialog>
  );
}
