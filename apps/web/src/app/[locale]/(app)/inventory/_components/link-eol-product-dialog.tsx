"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EolProductCombobox } from "@/components/eol-product-combobox";
import type { InventoryEolProduct, InventoryItemDetail } from "@/lib/inventory-types";

interface LinkEolProductDialogProps {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: (item: InventoryItemDetail) => void;
}

/** Vínculo manual com o catálogo local de frescor de versão - ação isolada
 * (endpoint próprio, `PATCH .../eol-link`), não bundlada no formulário geral
 * de edição do item, mesmo padrão de `LinkVendorDialog`. */
export function LinkEolProductDialog({
  itemId,
  open,
  onOpenChange,
  onLinked,
}: LinkEolProductDialogProps) {
  const t = useTranslations("Inventory");
  const api = useApi();

  const [submitting, setSubmitting] = React.useState(false);

  async function handleChange(product: InventoryEolProduct) {
    setSubmitting(true);
    try {
      const updated = await api.patch<InventoryItemDetail>(`/inventory/${itemId}/eol-link`, {
        eolProductId: product.slug,
      });
      onLinked(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("eolLinkError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("eolLinkDialogTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("eolLinkDialogHint")}</p>
        <EolProductCombobox value={null} onChange={handleChange} />
        {submitting && <p className="text-xs text-muted-foreground">{t("eolLinkSaving")}</p>}
      </DialogContent>
    </Dialog>
  );
}
