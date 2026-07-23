"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, Plus } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { usePermission } from "@/lib/use-permission";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import type { Area } from "@/lib/assessment-types";
import type { UserOption } from "@/lib/user-picker-types";
import { INVENTORY_STATUSES, type PaginatedInventory } from "@/lib/inventory-types";
import { ItemFormDialog } from "./_components/item-form-dialog";

const PAGE_SIZE = 20;
const ALL_STATUSES_VALUE = "__all__";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "outline"> = {
  ACTIVE: "success",
  PENDING_REVIEW: "secondary",
  EXPIRED: "destructive",
  DECOMMISSIONED: "outline",
};

export default function InventoryPage() {
  const t = useTranslations("Inventory");
  const criticalityT = useTranslations("Criticality");
  const user = useRequireAuth();
  const api = useApi();
  const canManage = usePermission("inventory:manage");

  const [status, setStatus] = React.useState<string>(ALL_STATUSES_VALUE);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedInventory | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const loadItems = React.useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams();
      if (status !== ALL_STATUSES_VALUE) params.set("status", status);
      params.set("page", String(targetPage));
      params.set("pageSize", String(PAGE_SIZE));
      return api
        .get<PaginatedInventory>(`/inventory?${params.toString()}`)
        .then((result) => {
          setData(result);
          setError(null);
        })
        .catch(() => setError(t("loadError")));
    },
    [status, api, t],
  );

  React.useEffect(() => {
    if (!user) return;
    void loadItems(page);
  }, [user, page, loadItems]);

  React.useEffect(() => {
    if (!user) return;
    api.get<Area[]>("/areas").then(setAreas).catch(() => {});
  }, [user, api]);

  React.useEffect(() => {
    if (!user || !canManage) return;
    api.get<UserOption[]>("/users").then(setUsers).catch(() => {});
  }, [user, canManage, api]);

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (status !== ALL_STATUSES_VALUE) params.set("status", status);
      params.set("format", format);
      const blob = await api.getBlob(`/inventory/export?${params.toString()}`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `inventario-${new Date().toISOString().slice(0, 10)}.${format}`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t("exportError"));
    } finally {
      setExporting(false);
    }
  }

  if (!user) return null;

  return (
    <>
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={exporting}>
                  {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                  {t("exportButton")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => handleExport("csv")}>
                  {t("exportCsv")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleExport("json")}>
                  {t("exportJson")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canManage && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus />
                {t("newButton")}
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("filtersTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <Select
                value={status}
                onValueChange={(value) => {
                  setPage(1);
                  setStatus(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUSES_VALUE}>{t("filterStatusAll")}</SelectItem>
                  {INVENTORY_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`statuses.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      <TableHead>{t("columnArea")}</TableHead>
                      <TableHead>{t("columnCriticality")}</TableHead>
                      <TableHead>{t("columnStatus")}</TableHead>
                      <TableHead>{t("columnNextReview")}</TableHead>
                      <TableHead>{t("columnTechnicalOpinion")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <Link href={`/inventory/${item.id}`} className="hover:underline">
                            {item.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{item.vendor}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.area.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {criticalityT(item.criticality)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[item.status]}>{t(`statuses.${item.status}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(item.nextReviewDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.technicalOpinion ? (
                            <Link
                              href={`/technical-opinions?number=${encodeURIComponent(item.technicalOpinion.number)}`}
                              className="hover:underline"
                            >
                              {item.technicalOpinion.number}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
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
      </div>

      {canManage && (
        <ItemFormDialog
          mode="create"
          areas={areas}
          users={users}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={() => {
            setCreateOpen(false);
            if (page === 1) {
              void loadItems(1);
            } else {
              setPage(1);
            }
          }}
        />
      )}
    </>
  );
}
