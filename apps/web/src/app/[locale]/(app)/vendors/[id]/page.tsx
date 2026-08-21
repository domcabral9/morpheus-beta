"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { usePermission } from "@/lib/use-permission";
import { useRouter, Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isVendorComplete, type VendorAssessmentSummary, type VendorDetail } from "@/lib/vendor-types";
import { TierBadge } from "@/components/tier-badge";
import { UserAvatar } from "@/components/user-avatar";
import { VendorFormDialog } from "../_components/vendor-form-dialog";
import { DeleteVendorDialog } from "../_components/delete-vendor-dialog";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default function VendorDetailPage() {
  const t = useTranslations("Vendors");
  const criticalityT = useTranslations("Criticality");
  const params = useParams<{ id: string }>();
  const user = useRequireAuth();
  const api = useApi();
  const router = useRouter();
  const canManage = usePermission("vendors:manage");

  const [vendor, setVendor] = React.useState<VendorDetail | null>(null);
  const [history, setHistory] = React.useState<VendorAssessmentSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [startingAssessment, setStartingAssessment] = React.useState(false);

  const load = React.useCallback(() => {
    return Promise.all([
      api.get<VendorDetail>(`/vendors/${params.id}`),
      api.get<VendorAssessmentSummary[]>(`/vendors/${params.id}/assessments`),
    ])
      .then(([vendorResult, historyResult]) => {
        setVendor(vendorResult);
        setHistory(historyResult);
        setError(null);
      })
      .catch(() => setError(t("detailLoadError")));
  }, [api, params.id, t]);

  React.useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  if (!user) return null;

  async function handleStartAssessment() {
    setStartingAssessment(true);
    try {
      const created = await api.post<{ id: string }>(`/vendors/${params.id}/assessments`, {});
      router.push(`/vendors/${params.id}/assessments/${created.id}`);
    } catch {
      setError(t("startAssessmentError"));
      setStartingAssessment(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-6">
        <Link href="/vendors" className="text-sm text-muted-foreground hover:text-foreground">
          {t("back")}
        </Link>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && !vendor && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        )}

        {vendor && (
          <>
            <Card>
              <CardHeader className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-xl">{vendor.name}</CardTitle>
                  {vendor.legalName && (
                    <span className="text-sm text-muted-foreground">{vendor.legalName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {vendor.currentTier && vendor.currentTierLabel ? (
                    <TierBadge tier={vendor.currentTier} label={vendor.currentTierLabel} />
                  ) : (
                    <Badge variant="outline">{t("neverAssessed")}</Badge>
                  )}
                  {!vendor.isActive && <Badge variant="outline">{t("inactiveBadge")}</Badge>}
                  {!isVendorComplete(vendor) && (
                    <Badge variant="secondary">{t("incompleteBadge")}</Badge>
                  )}
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                      {t("editButton")}
                    </Button>
                  )}
                  {canManage && (
                    <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                      {t("deleteButton")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={t("fieldTaxId")} value={vendor.taxId ?? "-"} />
                  <Field label={t("fieldContactName")} value={vendor.contactName ?? "-"} />
                  <Field label={t("fieldContactEmail")} value={vendor.contactEmail ?? "-"} />
                  <Field label={t("fieldContractReference")} value={vendor.contractReference ?? "-"} />
                  <Field
                    label={t("fieldBusinessCriticality")}
                    value={vendor.businessCriticality ? criticalityT(vendor.businessCriticality) : "-"}
                  />
                  <Field
                    label={t("fieldLastAssessedAt")}
                    value={vendor.lastAssessedAt ? new Date(vendor.lastAssessedAt).toLocaleDateString() : "-"}
                  />
                  <Field
                    label={t("fieldNextReviewDueAt")}
                    value={vendor.nextReviewDueAt ? new Date(vendor.nextReviewDueAt).toLocaleDateString() : "-"}
                  />
                </div>
                {vendor.notes && (
                  <div className="mt-4 flex flex-col gap-1 border-t pt-4">
                    <span className="text-xs text-muted-foreground">{t("fieldNotes")}</span>
                    <p className="text-sm">{vendor.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t("historyTitle")}</CardTitle>
                {canManage && (
                  <Button size="sm" onClick={() => void handleStartAssessment()} disabled={startingAssessment}>
                    <Plus />
                    {startingAssessment ? t("starting") : t("newAssessmentButton")}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {history && history.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
                )}
                {history && history.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("columnStatus")}</TableHead>
                        <TableHead>{t("columnTier")}</TableHead>
                        <TableHead>{t("columnPerformedBy")}</TableHead>
                        <TableHead>{t("columnCompletedAt")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((assessment) => (
                        <TableRow key={assessment.id}>
                          <TableCell>
                            <Link
                              href={`/vendors/${vendor.id}/assessments/${assessment.id}`}
                              className="hover:underline"
                            >
                              <Badge variant={assessment.status === "COMPLETED" ? "success" : "outline"}>
                                {t(`assessmentStatuses.${assessment.status}`)}
                              </Badge>
                            </Link>
                          </TableCell>
                          <TableCell>
                            {assessment.tier && assessment.tierLabel ? (
                              <TierBadge tier={assessment.tier} label={assessment.tierLabel} />
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={assessment.performedBy.name}
                                avatarUrl={
                                  assessment.performedBy.hasAvatar
                                    ? `/users/${assessment.performedBy.id}/avatar`
                                    : null
                                }
                                size="sm"
                              />
                              <span>{assessment.performedBy.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {assessment.completedAt
                              ? new Date(assessment.completedAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {vendor && canManage && (
        <VendorFormDialog
          mode="edit"
          vendor={vendor}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={(saved) => {
            setVendor(saved);
            setEditOpen(false);
          }}
        />
      )}

      {vendor && canManage && (
        <DeleteVendorDialog
          vendorId={vendor.id}
          vendorName={vendor.name}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => router.push("/vendors")}
        />
      )}
    </>
  );
}
