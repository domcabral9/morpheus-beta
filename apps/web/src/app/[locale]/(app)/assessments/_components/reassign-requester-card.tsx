"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssessmentDetail } from "@/lib/assessment-types";
import type { UserOption } from "@/lib/user-picker-types";

interface ReassignRequesterCardProps {
  assessmentId: string;
  currentRequester: { id: string; name: string; email: string };
  users: UserOption[];
  onReassigned: (assessment: AssessmentDetail) => void;
}

/** Só aparece pra quem tem `assessments:reopen` (papel "Administrador") numa
 * avaliação em `PENDING_RENEWAL` — cobre o caso do solicitante original ter
 * saído da empresa (ver plano de renovação anual, Fase 5). Reatribuir troca
 * `requesterId`; só o novo solicitante consegue editar/reenviar depois. */
export function ReassignRequesterCard({
  assessmentId,
  currentRequester,
  users,
  onReassigned,
}: ReassignRequesterCardProps) {
  const t = useTranslations("AssessmentDetail");
  const api = useApi();

  const candidates = users.filter((candidate) => candidate.id !== currentRequester.id);

  const [newRequesterId, setNewRequesterId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleReassign() {
    if (!newRequesterId) return;
    setSubmitting(true);
    try {
      const updated = await api.patch<AssessmentDetail>(`/assessments/${assessmentId}/renewal/reassign`, {
        newRequesterId,
        reason: reason || undefined,
      });
      toast.success(t("reassignSuccess"));
      onReassigned(updated);
      setNewRequesterId("");
      setReason("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("reassignError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("reassignTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t("reassignDescription", { name: currentRequester.name })}
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="newRequesterId">{t("reassignNewRequesterLabel")}</Label>
          <NativeSelect
            id="newRequesterId"
            value={newRequesterId}
            onChange={(event) => setNewRequesterId(event.target.value)}
            disabled={candidates.length === 0}
          >
            <option value="">{t("reassignSelectPlaceholder")}</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} ({candidate.email})
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reassignReason">{t("reassignReasonLabel")}</Label>
          <Textarea
            id="reassignReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("reassignReasonPlaceholder")}
          />
        </div>

        <div>
          <Button onClick={() => void handleReassign()} disabled={submitting || !newRequesterId}>
            {submitting ? t("reassignSubmitting") : t("reassignSubmit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
