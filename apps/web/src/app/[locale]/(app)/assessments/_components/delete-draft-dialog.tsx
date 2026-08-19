"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/lib/api-client";
import type { AssessmentDeletionInfo } from "@/lib/assessment-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";

const KEEP_VENDOR = "keep";
const DELETE_VENDOR = "delete";

interface DeleteDraftDialogProps {
  assessmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

/** Confirmação de exclusão de uma avaliação em rascunho (achado 2026-08-19:
 * não havia nenhum jeito de "desfazer" um rascunho de teste). Busca
 * `GET :id/deletion-info` ao abrir pra decidir se mostra a opção de excluir o
 * fornecedor vinculado junto (só quando ele for genuinamente órfão - ver
 * `AssessmentsService.resolveOrphanVendor`). */
export function DeleteDraftDialog({
  assessmentId,
  open,
  onOpenChange,
  onDeleted,
}: DeleteDraftDialogProps) {
  const t = useTranslations("AssessmentDetail");
  const api = useApi();

  const [info, setInfo] = React.useState<AssessmentDeletionInfo | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const { control, handleSubmit, reset } = useForm<{ choice: string }>({
    defaultValues: { choice: KEEP_VENDOR },
  });

  React.useEffect(() => {
    if (!open) return;
    // Reset intencional ao abrir o dialog - o resultado real vem da chamada
    // assíncrona logo abaixo, não há como derivar isso sem efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo(null);
    setLoadError(null);
    reset({ choice: KEEP_VENDOR });
    api
      .get<AssessmentDeletionInfo>(`/assessments/${assessmentId}/deletion-info`)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : t("deleteLoadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- api muda de referência a cada render por causa do accessToken; não precisa disparar de novo por isso
  }, [open, assessmentId]);

  async function onConfirm(values: { choice: string }) {
    setDeleting(true);
    try {
      await api.delete(`/assessments/${assessmentId}`, {
        deleteVendor: values.choice === DELETE_VENDOR,
      });
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

        {info && (
          <form onSubmit={handleSubmit(onConfirm)} className="flex flex-col gap-4">
            {info.orphanVendor && (
              <div className="flex flex-col gap-2">
                <Label>{t("deleteVendorChoiceLabel")}</Label>
                <Controller
                  control={control}
                  name="choice"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange}>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={KEEP_VENDOR} id="keep-vendor" />
                        <Label htmlFor="keep-vendor" className="font-normal">
                          {t("deleteAssessmentOnly")}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={DELETE_VENDOR} id="delete-vendor" />
                        <Label htmlFor="delete-vendor" className="font-normal">
                          {t("deleteAssessmentAndVendor", { name: info.orphanVendor!.name })}
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={deleting}>
                {deleting ? t("deleting") : t("deleteConfirm")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
