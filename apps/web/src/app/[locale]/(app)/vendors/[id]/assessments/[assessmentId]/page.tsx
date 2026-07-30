"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { ApiError } from "@/lib/api-client";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VendorAssessmentDetail, VendorQuestionCategory } from "@/lib/vendor-types";
import { TierBadge } from "@/components/tier-badge";

type LocalAnswer = { textValue?: string; scaleValue?: number; selectedOptionIds?: string[] };

export default function VendorAssessmentPage() {
  const t = useTranslations("Vendors");
  const params = useParams<{ id: string; assessmentId: string }>();
  const user = useRequireAuth();
  const api = useApi();
  const router = useRouter();

  const [assessment, setAssessment] = React.useState<VendorAssessmentDetail | null>(null);
  const [categories, setCategories] = React.useState<VendorQuestionCategory[] | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, LocalAnswer>>({});
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  const load = React.useCallback(async () => {
    const [assessmentResult, categoriesResult] = await Promise.all([
      api.get<VendorAssessmentDetail>(`/vendors/${params.id}/assessments/${params.assessmentId}`),
      api.get<VendorQuestionCategory[]>("/vendors/questionnaire/active"),
    ]);
    setAssessment(assessmentResult);
    setCategories(categoriesResult);
    const initial: Record<string, LocalAnswer> = {};
    for (const answer of assessmentResult.answers) {
      initial[answer.vendorQuestionId] = {
        textValue: answer.textValue ?? undefined,
        scaleValue: answer.scaleValue ?? undefined,
        selectedOptionIds: answer.selectedOptions.map((o) => o.vendorQuestionOption.id),
      };
    }
    setAnswers(initial);
  }, [api, params.id, params.assessmentId]);

  React.useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount idiomático, mesmo padrão de assessments/[id]/page.tsx
    load().catch((err) => setLoadError(err instanceof ApiError ? err.message : t("loadError")));
  }, [user, load, t]);

  if (!user) return null;

  const isEditable = Boolean(assessment) && assessment!.status === "DRAFT";

  function setAnswer(questionId: string, value: LocalAnswer) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...value } }));
  }

  function buildPayload() {
    return {
      answers: Object.entries(answers).map(([vendorQuestionId, value]) => ({
        vendorQuestionId,
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
      await api.patch(`/vendors/${params.id}/assessments/${params.assessmentId}`, buildPayload());
      setActionMessage(t("saveSuccess"));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    setActionError(null);
    setActionMessage(null);
    setCompleting(true);
    try {
      await api.patch(`/vendors/${params.id}/assessments/${params.assessmentId}`, buildPayload());
      const updated = await api.post<VendorAssessmentDetail>(
        `/vendors/${params.id}/assessments/${params.assessmentId}/complete`,
      );
      setAssessment(updated);
      setActionMessage(t("completeSuccess"));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("completeError"));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <Link
        href={`/vendors/${params.id}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
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
              <CardTitle>{assessment.vendor.name}</CardTitle>
              <div className="flex items-center gap-2">
                {assessment.tier && assessment.tierLabel ? (
                  <TierBadge tier={assessment.tier} label={assessment.tierLabel} />
                ) : (
                  <Badge variant="outline">{t(`assessmentStatuses.${assessment.status}`)}</Badge>
                )}
              </div>
            </CardHeader>
            {assessment.status === "COMPLETED" && assessment.totalScore && (
              <CardContent className="text-sm text-muted-foreground">
                {t("scoreSummary", { score: assessment.totalScore })}
              </CardContent>
            )}
          </Card>

          {!isEditable && assessment.status === "COMPLETED" && (
            <p className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              {t("readOnlyNotice")}
            </p>
          )}

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
                          onChange={(event) => setAnswer(question.id, { textValue: event.target.value })}
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
                            <label key={option.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name={question.id}
                                disabled={!isEditable}
                                className="accent-primary"
                                checked={answers[question.id]?.selectedOptionIds?.[0] === option.id}
                                onChange={() => setAnswer(question.id, { selectedOptionIds: [option.id] })}
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
                              <label key={option.id} className="flex items-center gap-2 text-sm">
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
                {saving ? t("saving") : t("saveDraft")}
              </Button>
              <Button onClick={() => void handleComplete()} disabled={completing}>
                {completing ? t("completing") : t("completeButton")}
              </Button>
            </div>
          )}

          {assessment.status === "COMPLETED" && (
            <div className="flex justify-end pb-8">
              <Button variant="outline" onClick={() => router.push(`/vendors/${params.id}`)}>
                {t("backToVendor")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
