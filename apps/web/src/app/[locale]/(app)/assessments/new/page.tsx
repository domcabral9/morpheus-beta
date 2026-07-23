"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Area, AssessmentDetail, Criticality } from "@/lib/assessment-types";

const CRITICALITY_OPTIONS: Criticality[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function NewAssessmentPage() {
  const t = useTranslations("NewAssessment");
  const criticalityT = useTranslations("Criticality");
  const user = useRequireAuth();
  const api = useApi();
  const router = useRouter();

  const [areas, setAreas] = React.useState<Area[] | null>(null);
  const [softwareName, setSoftwareName] = React.useState("");
  const [vendor, setVendor] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [areaId, setAreaId] = React.useState("");
  const [criticality, setCriticality] = React.useState<Criticality>("MEDIUM");
  const [justification, setJustification] = React.useState("");
  const [hasRiskAnalysis, setHasRiskAnalysis] = React.useState(false);
  const [hasInfoSecClause, setHasInfoSecClause] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    api
      .get<Area[]>("/areas")
      .then((result) => {
        setAreas(result);
        if (result.length > 0) setAreaId(result[0].id);
      })
      .catch(() => setError(t("genericError")));
  }, [user, api, t]);

  if (!user) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<AssessmentDetail>("/assessments", {
        softwareName,
        vendor,
        version: version || undefined,
        url: url || undefined,
        areaId,
        responsibleId: user!.id,
        criticality,
        justification,
        hasRiskAnalysis,
        hasInfoSecClause,
      });
      router.push(`/assessments/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 justify-center">
      <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="softwareName">{t("softwareNameLabel")}</Label>
                <Input
                  id="softwareName"
                  value={softwareName}
                  onChange={(event) => setSoftwareName(event.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vendor">{t("vendorLabel")}</Label>
                  <Input
                    id="vendor"
                    value={vendor}
                    onChange={(event) => setVendor(event.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="version">{t("versionLabel")}</Label>
                  <Input
                    id="version"
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="url">{t("urlLabel")}</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="area">{t("areaLabel")}</Label>
                  <NativeSelect
                    id="area"
                    value={areaId}
                    onChange={(event) => setAreaId(event.target.value)}
                    disabled={!areas}
                    required
                  >
                    {!areas && <option value="">{t("selectPlaceholder")}</option>}
                    {areas?.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="criticality">{t("criticalityLabel")}</Label>
                  <NativeSelect
                    id="criticality"
                    value={criticality}
                    onChange={(event) => setCriticality(event.target.value as Criticality)}
                  >
                    {CRITICALITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {criticalityT(option)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-md border p-3">
                <p className="text-sm font-medium">{t("vendorComplianceTitle")}</p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="hasRiskAnalysis"
                    checked={hasRiskAnalysis}
                    onCheckedChange={(checked) => setHasRiskAnalysis(checked === true)}
                  />
                  <Label htmlFor="hasRiskAnalysis" className="font-normal">
                    {t("hasRiskAnalysisLabel")}
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="hasInfoSecClause"
                    checked={hasInfoSecClause}
                    onCheckedChange={(checked) => setHasInfoSecClause(checked === true)}
                  />
                  <Label htmlFor="hasInfoSecClause" className="font-normal">
                    {t("hasInfoSecClauseLabel")}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">{t("vendorComplianceHint")}</p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="justification">{t("justificationLabel")}</Label>
                <Textarea
                  id="justification"
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  required
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="mt-2 flex justify-end gap-2">
                <Button type="submit" disabled={submitting || !areaId}>
                  {submitting ? t("submitting") : t("submit")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
    </div>
  );
}
