"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Download, Eye, Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssessmentVersionDetail } from "@/lib/assessment-types";

/** Linha do tempo de versões (envios/reenvios/renovações) de uma avaliação -
 * reaproveita `GET /assessments/:id/versions`, que já existia no backend mas
 * nunca tinha um consumidor no frontend (achado da auditoria de capacidade
 * órfã 2026-08-08, item 2). Mesmo padrão de `WorkflowHistorySection`: seção
 * autocontida com fetch próprio. Score/classificação e parecer emitido em
 * cada versão são snapshots daquele momento, nunca recalculados. */
export function VersionHistorySection({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations("AssessmentDetail");
  const api = useApi();

  const [versions, setVersions] = React.useState<AssessmentVersionDetail[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewingId, setViewingId] = React.useState<string | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewNumber, setPreviewNumber] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<AssessmentVersionDetail[]>(`/assessments/${assessmentId}/versions`)
      .then(setVersions)
      .catch(() => setError(t("versionHistoryLoadError")));
  }, [api, assessmentId, t]);

  /** Mesma técnica de `technical-opinions/page.tsx`: iframe num dialog em vez
   * de nova aba, já que o Chromium bloqueia navegar pra uma URL `blob:`
   * criada depois de um `await`. */
  async function handleView(opinionId: string, number: string) {
    setViewingId(opinionId);
    try {
      const blob = await api.getBlob(`/technical-opinions/${opinionId}/download`);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewNumber(number);
    } catch {
      setError(t("versionHistoryOpinionViewError"));
    } finally {
      setViewingId(null);
    }
  }

  async function handleDownload(opinionId: string, number: string) {
    setDownloadingId(opinionId);
    try {
      const blob = await api.getBlob(`/technical-opinions/${opinionId}/download`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t("versionHistoryOpinionDownloadError"));
    } finally {
      setDownloadingId(null);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewNumber(null);
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!versions) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (versions.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("versionHistoryTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {versions.map((version) => (
            <div key={version.id} className="flex flex-col gap-2 border-b pb-4 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{version.versionLabel}</span>
                {version.riskResult && (
                  <Badge variant="outline">
                    {t("versionHistoryScore", {
                      score: version.riskResult.totalScore,
                      classification: version.riskResult.riskClassification.label,
                    })}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <UserAvatar
                  name={version.createdBy.name}
                  avatarUrl={version.createdBy.hasAvatar ? `/users/${version.createdBy.id}/avatar` : null}
                  size="sm"
                />
                <p className="text-sm text-muted-foreground">
                  {t("versionHistoryCreatedBy", {
                    name: version.createdBy.name,
                    date: new Date(version.createdAt).toLocaleString(),
                  })}
                </p>
              </div>
              {version.changeReason && <p className="text-sm">{version.changeReason}</p>}
              {version.technicalOpinion && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t("versionHistoryOpinionIssued", { number: version.technicalOpinion.number })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={viewingId === version.technicalOpinion.id}
                    onClick={() =>
                      handleView(version.technicalOpinion!.id, version.technicalOpinion!.number)
                    }
                  >
                    {viewingId === version.technicalOpinion.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                    {t("versionHistoryOpinionView")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={downloadingId === version.technicalOpinion.id}
                    onClick={() =>
                      handleDownload(version.technicalOpinion!.id, version.technicalOpinion!.number)
                    }
                  >
                    {downloadingId === version.technicalOpinion.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    {t("versionHistoryOpinionDownload")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={previewUrl !== null} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="flex h-[85vh] max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle>{previewNumber}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              title={previewNumber ?? t("versionHistoryOpinionView")}
              className="flex-1 rounded-md border"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
