"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierBadge } from "@/components/tier-badge";
import type { VendorListItem, VendorTracking } from "@/lib/vendor-types";

function VendorRow({ vendor, trailing }: { vendor: VendorListItem; trailing: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <Link href={`/vendors/${vendor.id}`} className="text-sm hover:underline">
        {vendor.name}
      </Link>
      {trailing}
    </div>
  );
}

function Bucket({
  title,
  vendors,
  emptyLabel,
  trailing,
}: {
  title: string;
  vendors: VendorListItem[];
  emptyLabel: string;
  trailing: (vendor: VendorListItem) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title} ({vendors.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {vendors.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col">
            {vendors.map((vendor) => (
              <VendorRow key={vendor.id} vendor={vendor} trailing={trailing(vendor)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Tela "Acompanhamento" - equivalente, do lado de fornecedores, da inbox de
 * `/approvals` de Assessment, mas sem fila de decisão (VendorAssessment não
 * tem workflow de aprovação, decisão confirmada com o usuário) - aqui é uma
 * visão de monitoramento, não de ação pendente. */
export function VendorTrackingView() {
  const t = useTranslations("Vendors");
  const api = useApi();

  const [data, setData] = React.useState<VendorTracking | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<VendorTracking>("/vendors/tracking")
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(() => setError(t("trackingLoadError")));
  }, [api, t]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (!data) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Bucket
        title={t("trackingNeverAssessedTitle")}
        vendors={data.neverAssessed}
        emptyLabel={t("trackingNeverAssessedEmpty")}
        trailing={() => (
          <span className="text-xs text-muted-foreground">{t("trackingNeverAssessedTag")}</span>
        )}
      />
      <Bucket
        title={t("trackingOverdueTitle")}
        vendors={data.overdue}
        emptyLabel={t("trackingOverdueEmpty")}
        trailing={(vendor) => (
          <span className="flex items-center gap-2">
            {vendor.currentTier && vendor.currentTierLabel && (
              <TierBadge tier={vendor.currentTier} label={vendor.currentTierLabel} />
            )}
            <span className="text-xs text-muted-foreground">
              {vendor.nextReviewDueAt && new Date(vendor.nextReviewDueAt).toLocaleDateString()}
            </span>
          </span>
        )}
      />
      <Bucket
        title={t("trackingDueSoonTitle")}
        vendors={data.dueSoon}
        emptyLabel={t("trackingDueSoonEmpty")}
        trailing={(vendor) => (
          <span className="flex items-center gap-2">
            {vendor.currentTier && vendor.currentTierLabel && (
              <TierBadge tier={vendor.currentTier} label={vendor.currentTierLabel} />
            )}
            <span className="text-xs text-muted-foreground">
              {vendor.nextReviewDueAt && new Date(vendor.nextReviewDueAt).toLocaleDateString()}
            </span>
          </span>
        )}
      />
    </div>
  );
}
