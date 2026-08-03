"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { usePermission } from "@/lib/use-permission";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/components/auth-provider";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierBadge } from "@/components/tier-badge";
import type { Area } from "@/lib/assessment-types";
import type { UserOption } from "@/lib/user-picker-types";
import type { InventoryItemDetail } from "@/lib/inventory-types";
import { ItemFormDialog } from "../_components/item-form-dialog";
import { LinkVendorDialog } from "../_components/link-vendor-dialog";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "outline" | "warning"> = {
  ACTIVE: "success",
  PENDING_REVIEW: "secondary",
  PENDING_APPROVAL: "warning",
  REJECTED: "destructive",
  EXPIRED: "destructive",
  DECOMMISSIONED: "outline",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default function InventoryItemPage() {
  const t = useTranslations("Inventory");
  const criticalityT = useTranslations("Criticality");
  const params = useParams<{ id: string }>();
  const user = useRequireAuth();
  const api = useApi();
  const router = useRouter();
  const canManage = usePermission("inventory:manage");
  const canViewVendors = usePermission("vendors:view");
  const canManageVendors = usePermission("vendors:manage");

  const [item, setItem] = React.useState<InventoryItemDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [linkVendorOpen, setLinkVendorOpen] = React.useState(false);
  const [startingArt, setStartingArt] = React.useState(false);
  const [resubmitting, setResubmitting] = React.useState(false);

  const loadItem = React.useCallback(() => {
    return api
      .get<InventoryItemDetail>(`/inventory/${params.id}`)
      .then((result) => {
        setItem(result);
        setError(null);
      })
      .catch(() => setError(t("detailLoadError")));
  }, [api, params.id, t]);

  React.useEffect(() => {
    if (!user) return;
    void loadItem();
  }, [user, loadItem]);

  React.useEffect(() => {
    if (!user) return;
    api.get<Area[]>("/areas").then(setAreas).catch(() => {});
  }, [user, api]);

  React.useEffect(() => {
    if (!user || !canManage) return;
    api.get<UserOption[]>("/users").then(setUsers).catch(() => {});
  }, [user, canManage, api]);

  if (!user) return null;

  async function handleStartArt(vendorId: string) {
    setStartingArt(true);
    try {
      const created = await api.post<{ id: string }>(`/vendors/${vendorId}/assessments`, {});
      router.push(`/vendors/${vendorId}/assessments/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("vendorArtStartError"));
      setStartingArt(false);
    }
  }

  async function handleResubmit() {
    setResubmitting(true);
    try {
      const updated = await api.post<InventoryItemDetail>(`/inventory/${params.id}/resubmit`, {});
      setItem(updated);
      toast.success(t("resubmitSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("resubmitError"));
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-6">
        <Link href="/inventory" className="text-sm text-muted-foreground hover:text-foreground">
          {t("back")}
        </Link>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && !item && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        )}

        {item && (
          <Card>
            <CardHeader className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xl">{item.name}</CardTitle>
                <span className="text-sm text-muted-foreground">{item.vendor}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[item.status]}>{t(`statuses.${item.status}`)}</Badge>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    {t("editButton")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {item.status === "PENDING_APPROVAL" && (
                <div className="mb-4 rounded-md border border-chart-warning/50 bg-chart-warning/10 p-3 text-sm">
                  {t("pendingApprovalHint")}
                </div>
              )}

              {item.status === "REJECTED" && (
                <div className="mb-4 flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">{t("rejectionReasonTitle")}</p>
                  <p>{item.approvalRequest?.decisionNotes}</p>
                  {item.createdById === user.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      disabled={resubmitting}
                      onClick={handleResubmit}
                    >
                      {resubmitting ? t("resubmitting") : t("resubmitButton")}
                    </Button>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={t("fieldVersion")} value={item.version ?? "—"} />
                <Field
                  label={t("fieldUrl")}
                  value={
                    item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {item.url}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Field label={t("fieldCategory")} value={item.category} />
                <Field label={t("fieldType")} value={t(`types.${item.type}`)} />
                <Field label={t("fieldHostingProvider")} value={item.hostingProvider ?? "—"} />
                <Field label={t("fieldArea")} value={item.area.name} />
                <Field
                  label={t("fieldManagerId")}
                  value={`${item.manager.name} (${item.manager.email})`}
                />
                <Field
                  label={t("fieldTechnicalResponsibleId")}
                  value={`${item.technicalResponsible.name} (${item.technicalResponsible.email})`}
                />
                <Field
                  label={t("fieldHomologationDate")}
                  value={new Date(item.homologationDate).toLocaleDateString()}
                />
                <Field
                  label={t("fieldNextReviewDate")}
                  value={new Date(item.nextReviewDate).toLocaleDateString()}
                />
                <Field label={t("fieldCriticality")} value={criticalityT(item.criticality)} />
                <Field
                  label={t("fieldDataClassification")}
                  value={t(`dataClassifications.${item.dataClassification}`)}
                />
                <Field
                  label={t("fieldTechnicalOpinion")}
                  value={
                    item.technicalOpinion ? (
                      <Link
                        href={`/technical-opinions?number=${encodeURIComponent(item.technicalOpinion.number)}`}
                        className="hover:underline"
                      >
                        {item.technicalOpinion.number}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t("technicalOpinionNone")}</span>
                    )
                  }
                />
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                <span className="text-xs text-muted-foreground">{t("vendorComplianceTitle")}</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="flex items-center gap-2">
                    {t("hasRiskAnalysisLabel")}
                    <Badge variant={item.hasRiskAnalysis ? "success" : "destructive"}>
                      {item.hasRiskAnalysis ? t("yes") : t("no")}
                    </Badge>
                  </span>
                  <span className="flex items-center gap-2">
                    {t("hasInfoSecClauseLabel")}
                    <Badge variant={item.hasInfoSecClause ? "success" : "destructive"}>
                      {item.hasInfoSecClause ? t("yes") : t("no")}
                    </Badge>
                  </span>
                </div>
                {item.assessmentId && (
                  <p className="text-xs text-muted-foreground">{t("vendorComplianceInheritedHint")}</p>
                )}
              </div>

              {canViewVendors && (
                <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                  <span className="text-xs text-muted-foreground">{t("vendorArtTitle")}</span>
                  {!item.linkedVendor && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-muted-foreground">{t("vendorArtNoneLinked")}</span>
                      {canManageVendors && (
                        <Button size="sm" variant="outline" onClick={() => setLinkVendorOpen(true)}>
                          {t("vendorArtLinkButton")}
                        </Button>
                      )}
                    </div>
                  )}
                  {item.linkedVendor && item.linkedVendor.currentTier === null && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm">{item.linkedVendor.name}</span>
                      <span className="text-sm text-muted-foreground">{t("vendorArtNeverAssessed")}</span>
                      {canManageVendors && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={startingArt}
                          onClick={() => handleStartArt(item.linkedVendor!.id)}
                        >
                          {startingArt ? t("vendorArtStarting") : t("vendorArtStartButton")}
                        </Button>
                      )}
                    </div>
                  )}
                  {item.linkedVendor && item.linkedVendor.currentTier !== null && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm">{item.linkedVendor.name}</span>
                      <TierBadge
                        tier={item.linkedVendor.currentTier}
                        label={item.linkedVendor.currentTierLabel ?? ""}
                      />
                      <Link
                        href={`/vendors/${item.linkedVendor.id}`}
                        className="text-sm hover:underline"
                      >
                        {t("vendorArtViewLink")}
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {item.documentationLinks.length > 0 && (
                <div className="mt-4 flex flex-col gap-1 border-t pt-4">
                  <span className="text-xs text-muted-foreground">{t("documentationLinksTitle")}</span>
                  <ul className="flex flex-col gap-1">
                    {item.documentationLinks.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm hover:underline"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {item && canManage && (
        <ItemFormDialog
          mode="edit"
          item={item}
          areas={areas}
          users={users}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={(saved) => {
            setItem(saved);
            setEditOpen(false);
          }}
        />
      )}

      {item && canManageVendors && (
        <LinkVendorDialog itemId={item.id} open={linkVendorOpen} onOpenChange={setLinkVendorOpen} />
      )}
    </>
  );
}
