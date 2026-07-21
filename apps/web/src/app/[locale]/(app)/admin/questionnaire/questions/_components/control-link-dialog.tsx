"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { ControlSummary, QuestionAdmin } from "@/lib/questionnaire-admin-types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ControlLinkDialogProps {
  question: QuestionAdmin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: (question: QuestionAdmin) => void;
}

export function ControlLinkDialog({ question, open, onOpenChange, onLinked }: ControlLinkDialogProps) {
  const t = useTranslations("AdminQuestionnaire");
  const api = useApi();

  const [controls, setControls] = React.useState<ControlSummary[] | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    // O componente só é montado quando o Dialog abre (renderização condicional
    // no pai) - busca uma vez, sem precisar reagir a `open` mudando.
    api.get<ControlSummary[]>("/controls").then(setControls).catch(() => setControls([]));
  }, [api]);

  const linkedIds = new Set(question.controls.map((link) => link.controlId));
  const availableControls = (controls ?? []).filter((control) => !linkedIds.has(control.id));

  async function handleLink() {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const updated = await api.post<QuestionAdmin>(`/questionnaire/admin/questions/${question.id}/controls`, {
        controlId: selectedId,
      });
      toast.success(t("question.controlLinkSuccess"));
      onLinked(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("question.controlLinkError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("question.linkControlTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="control-select">{t("question.controlSelectLabel")}</Label>
            <Select value={selectedId} onValueChange={setSelectedId} disabled={!controls}>
              <SelectTrigger id="control-select">
                <SelectValue placeholder={t("question.controlSelectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {availableControls.map((control) => (
                  <SelectItem key={control.id} value={control.id}>
                    [{control.framework.code}] {control.code} - {control.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {controls && availableControls.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("question.noControlsAvailable")}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" disabled={!selectedId || submitting} onClick={handleLink}>
              {submitting ? t("saving") : t("question.linkButton")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
