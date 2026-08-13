"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Search } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import type { PaginatedVendors } from "@/lib/vendor-types";
import { TierBadge } from "@/components/tier-badge";
import { VendorFormDialog } from "./vendor-form-dialog";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

interface VendorListViewProps {
  canManage: boolean;
}

export function VendorListView({ canManage }: VendorListViewProps) {
  const t = useTranslations("Vendors");
  const criticalityT = useTranslations("Criticality");
  const api = useApi();

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedVendors | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const loadVendors = React.useCallback(
    (targetPage: number, targetSearch: string) => {
      const params = new URLSearchParams();
      if (targetSearch) params.set("search", targetSearch);
      params.set("page", String(targetPage));
      params.set("pageSize", String(PAGE_SIZE));
      return api
        .get<PaginatedVendors>(`/vendors?${params.toString()}`)
        .then((result) => {
          setData(result);
          setError(null);
        })
        .catch(() => setError(t("loadError")));
    },
    [api, t],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      void loadVendors(1, search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadVendors muda de referência a cada render por causa do accessToken; não precisa disparar o debounce de novo por isso
  }, [search]);

  React.useEffect(() => {
    void loadVendors(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recarrega quando a página muda aqui; busca já tem seu próprio efeito com debounce
  }, [page]);

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("filtersTitle")}</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("newButton")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!error && !data && (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          )}

          {data && data.items.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          )}

          {data && data.items.length > 0 && (
            <div className="flex flex-col gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columnName")}</TableHead>
                    <TableHead>{t("columnCriticality")}</TableHead>
                    <TableHead>{t("columnTier")}</TableHead>
                    <TableHead>{t("columnLastAssessed")}</TableHead>
                    <TableHead>{t("columnNextReview")}</TableHead>
                    <TableHead>{t("columnAssessmentCount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        <Link href={`/vendors/${vendor.id}`} className="hover:underline">
                          {vendor.name}
                        </Link>
                        {!vendor.isActive && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {t("inactiveBadge")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {vendor.businessCriticality ? criticalityT(vendor.businessCriticality) : "-"}
                      </TableCell>
                      <TableCell>
                        {vendor.currentTier && vendor.currentTierLabel ? (
                          <TierBadge tier={vendor.currentTier} label={vendor.currentTierLabel} />
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("neverAssessed")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {vendor.lastAssessedAt ? new Date(vendor.lastAssessedAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {vendor.nextReviewDueAt ? new Date(vendor.nextReviewDueAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{vendor._count.assessments}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                labels={{
                  previous: t("paginationPrevious"),
                  next: t("paginationNext"),
                  pageOf: (current, total) => t("paginationPageOf", { current, total }),
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <VendorFormDialog
          mode="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={() => {
            setCreateOpen(false);
            setPage(1);
            void loadVendors(1, search);
          }}
        />
      )}
    </div>
  );
}
