"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/lib/api-client";
import type { VendorDeletionInfo } from "@/lib/vendor-types";
import { Link } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteVendorDialogProps {
  vendorId: string;
  vendorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

/** Confirmação de exclusão de fornecedor órfão (achado 2026-08-20) - busca
 * `GET :id/deletion-info` ao abrir pra decidir entre confirmação simples
 * (órfão) ou um resumo dos vínculos ativos que bloqueiam a exclusão. */
export function DeleteVendorDialog({
  vendorId,
  vendorName,
  open,
  onOpenChange,
  onDeleted,
}: DeleteVendorDialogProps) {
  const t = useTranslations("Vendors");

  const api = useApi();

  const [info, setInfo] = React.useState<VendorDeletionInfo | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    // Reset intencional ao abrir o dialog - o resultado real vem da chamada
    // assíncrona logo abaixo, não há como derivar isso sem efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo(null);
    setLoadError(null);
    api
      .get<VendorDeletionInfo>(`/vendors/${vendorId}/deletion-info`)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : t("deleteLoadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- api muda de referência a cada render por causa do accessToken; não precisa disparar de novo por isso
  }, [open, vendorId]);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await api.delete(`/vendors/${vendorId}`);
      toast.success(t("deleteSuccess"));
      onDeleted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteDialogTitle")}</DialogTitle>
          <DialogDescription>{t("deleteDialogDescription")}</DialogDescription>
        </DialogHeader>

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {!loadError && !info && (
          <p className="text-sm text-muted-foreground">{t("deleteLoading")}</p>
        )}

        {info && info.canDelete && (
          <>
            <p className="text-sm text-muted-foreground">{t("deleteConfirmDescription")}</p>
            <DialogFooter>
              <Button type="button" variant="destructive" disabled={deleting} onClick={handleConfirm}>
                {deleting ? t("deleting") : t("deleteConfirm")}
              </Button>
            </DialogFooter>
          </>
        )}

        {info && !info.canDelete && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-destructive">{t("deleteBlockedTitle")}</p>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {info.inventoryCount > 0 && (
                  <li>{t("deleteBlockedInventory", { count: info.inventoryCount })}</li>
                )}
                {info.assessmentCount > 0 && (
                  <li>{t("deleteBlockedAssessments", { count: info.assessmentCount })}</li>
                )}
                {info.vendorAssessmentCount > 0 && (
                  <li>
                    {t("deleteBlockedVendorAssessments", { count: info.vendorAssessmentCount })}
                  </li>
                )}
              </ul>
              {info.inventoryCount > 0 && (
                <Link
                  href={`/inventory?vendorId=${vendorId}&vendorName=${encodeURIComponent(vendorName)}`}
                  className="text-sm underline"
                >
                  {t("deleteBlockedViewInventory")}
                </Link>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("deleteBlockedClose")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
