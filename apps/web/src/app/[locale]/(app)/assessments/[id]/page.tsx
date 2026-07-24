"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { usePermission } from "@/lib/use-permission";
import { ApiError } from "@/lib/api-client";
import { Link } from "@/i18n/navigation";
import { AssessmentStatusBadge } from "@/components/assessment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AssessmentAnswer,
  AssessmentDetail,
  QuestionCategory,
} from "@/lib/assessment-types";
import type { UserOption } from "@/lib/user-picker-types";
import { WorkflowHistorySection } from "../_components/workflow-history-section";
import { ReassignRequesterCard } from "../_components/reassign-requester-card";

type LocalAnswer = { textValue?: string; scaleValue?: number; selectedOptionIds?: string[] };

const EDITABLE_STATUSES = new Set(["DRAFT", "PENDING_ADJUSTMENT", "PENDING_RENEWAL"]);

export default function AssessmentDetailPage() {
  const t = useTranslations("AssessmentDetail");
  const criticalityT = useTranslations("Criticality");
  const params = useParams<{ id: string }>();
  const user = useRequireAuth();
  const api = useApi();
  const canReassignRequester = usePermission("assessments:reopen");

  const [assessment, setAssessment] = React.useState<AssessmentDetail | null>(null);
  const [categories, setCategories] = React.useState<QuestionCategory[] | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, LocalAnswer>>({});
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

  async function handleSave() {
    setActionError(null);
    setActionMessage(null);
    setSaving(true);
    try {
      await api.put(`/assessments/${params.id}/answers`, buildPayload());
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
      await api.put(`/assessments/${params.id}/answers`, buildPayload());
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
                <AssessmentStatusBadge status={assessment.status} />
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
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{t("justification")}: </span>
                  {assessment.justification}
                </div>
              </CardContent>
            </Card>

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

            <h2 className="text-lg font-semibold tracking-tight">{t("questionnaire")}</h2>

            {categories
              ?.filter((category) => category.questions.length > 0)
              .map((category) => (
                <Card key={category.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{category.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    {category.questions.map((question) => (
                      <div key={question.id} className="flex flex-col gap-2">
                        <label className="text-sm font-medium">
                          {question.text}
                          {question.isRequired && (
                            <span className="ml-1 text-destructive" aria-label={t("requiredMark")}>
                              *
                            </span>
                          )}
                        </label>
                        {question.description && (
                          <p className="text-xs text-muted-foreground">{question.description}</p>
                        )}

                        {question.type === "TEXT" && (
                          <Textarea
                            disabled={!isEditable}
                            placeholder={t("textPlaceholder")}
                            value={answers[question.id]?.textValue ?? ""}
                            onChange={(event) =>
                              setAnswer(question.id, { textValue: event.target.value })
                            }
                          />
                        )}

                        {question.type === "SCALE" && (
                          <input
                            type="number"
                            disabled={!isEditable}
                            className="h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            value={answers[question.id]?.scaleValue ?? ""}
                            onChange={(event) =>
                              setAnswer(question.id, { scaleValue: Number(event.target.value) })
                            }
                          />
                        )}

                        {question.type === "SINGLE_CHOICE" && (
                          <div className="flex flex-col gap-1.5">
                            {question.options.map((option) => (
                              <label
                                key={option.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                <input
                                  type="radio"
                                  name={question.id}
                                  disabled={!isEditable}
                                  className="accent-primary"
                                  checked={
                                    answers[question.id]?.selectedOptionIds?.[0] === option.id
                                  }
                                  onChange={() =>
                                    setAnswer(question.id, { selectedOptionIds: [option.id] })
                                  }
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                        )}

                        {question.type === "MULTI_CHOICE" && (
                          <div className="flex flex-col gap-1.5">
                            {question.options.map((option) => {
                              const selected = answers[question.id]?.selectedOptionIds ?? [];
                              const checked = selected.includes(option.id);
                              return (
                                <label
                                  key={option.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    disabled={!isEditable}
                                    className="accent-primary"
                                    checked={checked}
                                    onChange={() =>
                                      setAnswer(question.id, {
                                        selectedOptionIds: checked
                                          ? selected.filter((id) => id !== option.id)
                                          : [...selected, option.id],
                                      })
                                    }
                                  />
                                  {option.label}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}

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
          </>
        )}
    </div>
  );
}
