"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { usePermission } from "@/lib/use-permission";
import { ApiError } from "@/lib/api-client";
import { Link, useRouter } from "@/i18n/navigation";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionnaireForm } from "@/components/questionnaire-form";
import { AttachmentsPanel } from "@/components/attachments-panel";
import type {
  AssessmentAnswer,
  AssessmentDetail,
  QuestionCategory,
} from "@/lib/assessment-types";
import type { UserOption } from "@/lib/user-picker-types";
import { WorkflowHistorySection } from "../_components/workflow-history-section";
import { VersionHistorySection } from "../_components/version-history-section";
import { ReassignRequesterCard } from "../_components/reassign-requester-card";
import { DeleteDraftDialog } from "../_components/delete-draft-dialog";

type LocalAnswer = { textValue?: string; scaleValue?: number; selectedOptionIds?: string[] };

const EDITABLE_STATUSES = new Set(["DRAFT", "PENDING_ADJUSTMENT", "PENDING_RENEWAL"]);

export default function AssessmentDetailPage() {
  const t = useTranslations("AssessmentDetail");
  const criticalityT = useTranslations("Criticality");
  const params = useParams<{ id: string }>();
  const user = useRequireAuth();
  const api = useApi();
  const router = useRouter();
  const canReassignRequester = usePermission("assessments:reopen");
  const canViewAllAssessments = usePermission("assessments:view-all");

  const [assessment, setAssessment] = React.useState<AssessmentDetail | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [categories, setCategories] = React.useState<QuestionCategory[] | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, LocalAnswer>>({});
  const [hasSoc2Report, setHasSoc2Report] = React.useState(false);
  const [hasIso27001Certificate, setHasIso27001Certificate] = React.useState(false);
  const [tenantUsers, setTenantUsers] = React.useState<UserOption[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    const [assessmentResult, categoriesResult, answersResult] = await Promise.all([
      api.get<AssessmentDetail>(`/assessments/${params.id}`),
      api.get<QuestionCategory[]>("/questionnaire/categories"),
      api.get<AssessmentAnswer[]>(`/assessments/${params.id}/answers`),
    ]);
    setAssessment(assessmentResult);
    setHasSoc2Report(assessmentResult.hasSoc2Report);
    setHasIso27001Certificate(assessmentResult.hasIso27001Certificate);
    setCategories(categoriesResult);
    const initial: Record<string, LocalAnswer> = {};
    for (const answer of answersResult) {
      initial[answer.questionId] = {
        textValue: answer.textValue ?? undefined,
        scaleValue: answer.scaleValue ?? undefined,
        selectedOptionIds: answer.selectedOptions.map((o) => o.questionOptionId),
      };
    }
    setAnswers(initial);
  }, [api, params.id]);

  React.useEffect(() => {
    if (!user) return;
    // Fetch-on-mount idiomático (mesmo caso de theme-provider.tsx):
    // o setState só roda depois do await dentro de load()/catch, mas a regra
    // experimental do react-hooks não consegue provar isso estaticamente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((err) => setLoadError(err instanceof ApiError ? err.message : t("loadError")));
  }, [user, load, t]);

  React.useEffect(() => {
    if (!user || !canReassignRequester) return;
    api.get<UserOption[]>("/users").then(setTenantUsers).catch(() => {});
  }, [user, canReassignRequester, api]);

  if (!user) return null;

  const isEditable =
    Boolean(assessment) &&
    EDITABLE_STATUSES.has(assessment!.status) &&
    assessment!.requesterId === user.id;

  const canUploadAttachments =
    Boolean(assessment) &&
    (assessment!.requesterId === user.id || canViewAllAssessments);

  const canDeleteDraft =
    Boolean(assessment) &&
    assessment!.status === "DRAFT" &&
    assessment!.requesterId === user.id;

  function setAnswer(questionId: string, value: LocalAnswer) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...value } }));
  }

  function buildPayload() {
    return {
      answers: Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        textValue: value.textValue,
        scaleValue: value.scaleValue,
        selectedOptionIds: value.selectedOptionIds,
      })),
    };
  }

  function complianceEvidencePayload() {
    return { hasSoc2Report, hasIso27001Certificate };
  }

  async function handleSave() {
    setActionError(null);
    setActionMessage(null);
    setSaving(true);
    try {
      await Promise.all([
        api.put(`/assessments/${params.id}/answers`, buildPayload()),
        api.patch(`/assessments/${params.id}`, complianceEvidencePayload()),
      ]);
      setActionMessage(t("saveSuccess"));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setActionError(null);
    setActionMessage(null);
    setSubmitting(true);
    try {
      await Promise.all([
        api.put(`/assessments/${params.id}/answers`, buildPayload()),
        api.patch(`/assessments/${params.id}`, complianceEvidencePayload()),
      ]);
      const updated = await api.post<AssessmentDetail>(`/assessments/${params.id}/submit`);
      setAssessment(updated);
      setActionMessage(t("submitSuccess"));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {!loadError && !assessment && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        )}

        {assessment && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{assessment.softwareName}</CardTitle>
                <div className="flex items-center gap-2">
                  <AssessmentStatusBadge status={assessment.status} />
                  {canDeleteDraft && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      {t("deleteDraftButton")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">{t("vendor")}: </span>
                  {assessment.vendor}
                </div>
                {assessment.version && (
                  <div>
                    <span className="text-muted-foreground">{t("version")}: </span>
                    {assessment.version}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">{t("area")}: </span>
                  {assessment.area.name}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("responsible")}: </span>
                  {assessment.responsible.name}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{t("criticality")}: </span>
                  {criticalityT(assessment.criticality)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t("hasRiskAnalysis")}: </span>
                  <Badge variant={assessment.hasRiskAnalysis ? "success" : "destructive"}>
                    {assessment.hasRiskAnalysis ? t("yes") : t("no")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t("hasInfoSecClause")}: </span>
                  <Badge variant={assessment.hasInfoSecClause ? "success" : "destructive"}>
                    {assessment.hasInfoSecClause ? t("yes") : t("no")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t("hasSoc2Report")}: </span>
                  {isEditable ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="hasSoc2Report"
                        checked={hasSoc2Report}
                        onCheckedChange={(checked) => setHasSoc2Report(checked === true)}
                      />
                      <Label htmlFor="hasSoc2Report" className="font-normal">
                        {t("yes")}
                      </Label>
                    </div>
                  ) : (
                    <Badge variant={assessment.hasSoc2Report ? "success" : "destructive"}>
                      {assessment.hasSoc2Report ? t("yes") : t("no")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t("hasIso27001Certificate")}: </span>
                  {isEditable ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="hasIso27001Certificate"
                        checked={hasIso27001Certificate}
                        onCheckedChange={(checked) => setHasIso27001Certificate(checked === true)}
                      />
                      <Label htmlFor="hasIso27001Certificate" className="font-normal">
                        {t("yes")}
                      </Label>
                    </div>
                  ) : (
                    <Badge variant={assessment.hasIso27001Certificate ? "success" : "destructive"}>
                      {assessment.hasIso27001Certificate ? t("yes") : t("no")}
                    </Badge>
                  )}
                </div>
                {isEditable && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    {t("complianceEvidenceHint")}
                  </p>
                )}
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{t("justification")}: </span>
                  {assessment.justification}
                </div>
              </CardContent>
            </Card>

            <AttachmentsPanel
              parent={{ assessmentId: assessment.id }}
              canUpload={canUploadAttachments}
            />

            {!isEditable && (
              <p className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                {t("readOnlyNotice", { status: assessment.status })}
              </p>
            )}

            {canReassignRequester && assessment.status === "PENDING_RENEWAL" && (
              <ReassignRequesterCard
                assessmentId={assessment.id}
                currentRequester={assessment.requester}
                users={tenantUsers}
                onReassigned={setAssessment}
              />
            )}

            <WorkflowHistorySection assessmentId={assessment.id} />

            <VersionHistorySection assessmentId={assessment.id} />

            <h2 className="text-lg font-semibold tracking-tight">{t("questionnaire")}</h2>

            {categories && (
              <QuestionnaireForm
                categories={categories}
                answers={answers}
                onAnswer={setAnswer}
                isEditable={isEditable}
                requiredMarkLabel={t("requiredMark")}
                textPlaceholder={t("textPlaceholder")}
              />
            )}

            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            {actionMessage && <p className="text-sm text-success">{actionMessage}</p>}

            {isEditable && (
              <div className="flex justify-end gap-2 pb-8">
                <Button variant="outline" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? t("saving") : t("saveAnswers")}
                </Button>
                <Button onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? t("submitting") : t("submitButton")}
                </Button>
              </div>
            )}

            {canDeleteDraft && (
              <DeleteDraftDialog
                assessmentId={assessment.id}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onDeleted={() => router.push("/dashboard")}
              />
            )}
          </>
        )}
    </div>
  );
}
