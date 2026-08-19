"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VendorComplianceEvidence } from "@/lib/vendor-types";

/** Painel de reaproveitamento na ART do fornecedor - avaliações de Software
 * deste fornecedor que já declararam SOC 2/ISO 27001 (com anexo validado no
 * envio), pra o avaliador não precisar pedir o mesmo documento de novo.
 * Puramente informativo, com link de volta pra `/assessments/:id`, onde o
 * anexo em si já pode ser aberto via `AttachmentsPanel` - mesmo padrão de
 * `WorkflowHistorySection`/`VersionHistorySection`: seção autocontida, sem
 * card quando a lista vem vazia. */
export function ComplianceEvidencePanel({ vendorId }: { vendorId: string }) {
  const t = useTranslations("Vendors");
  const api = useApi();

  const [evidence, setEvidence] = React.useState<VendorComplianceEvidence[] | null>(null);

  React.useEffect(() => {
    api
      .get<VendorComplianceEvidence[]>(`/vendors/${vendorId}/compliance-evidence`)
      .then(setEvidence)
      .catch(() => setEvidence([]));
  }, [api, vendorId]);

  if (!evidence || evidence.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("complianceEvidenceTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("complianceEvidenceDescription")}</p>
        {evidence.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-2 border-b pb-3 last:border-b-0 last:pb-0">
            <Link href={`/assessments/${item.id}`} className="text-sm font-medium hover:underline">
              {item.softwareName}
            </Link>
            {item.hasSoc2Report && <Badge variant="outline">{t("complianceEvidenceSoc2")}</Badge>}
            {item.hasIso27001Certificate && (
              <Badge variant="outline">{t("complianceEvidenceIso27001")}</Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
