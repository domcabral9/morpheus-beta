"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, Plus } from "lucide-react";

import { useApi } from "@/lib/use-api";
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
import {
  CRITICALITY_VALUES,
  INVENTORY_STATUSES,
  SOFTWARE_TYPES,
  type PaginatedInventory,
} from "@/lib/inventory-types";
import { ItemFormDialog } from "./item-form-dialog";

const PAGE_SIZE = 20;
const ALL_VALUE = "__all__";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "destructive" | "outline"> = {
  ACTIVE: "success",
  PENDING_REVIEW: "secondary",
  EXPIRED: "destructive",
  DECOMMISSIONED: "outline",
};

interface Filters {
  status: string;
  areaId: string;
  type: string;
  criticality: string;
  origin: string;
  hasRiskAnalysis: string;
  hasInfoSecClause: string;
}

const EMPTY_FILTERS: Filters = {
  status: ALL_VALUE,
  areaId: ALL_VALUE,
  type: ALL_VALUE,
  criticality: ALL_VALUE,
  origin: ALL_VALUE,
  hasRiskAnalysis: ALL_VALUE,
  hasInfoSecClause: ALL_VALUE,
};

function buildQuery(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  if (filters.status !== ALL_VALUE) params.set("status", filters.status);
  if (filters.areaId !== ALL_VALUE) params.set("areaId", filters.areaId);
  if (filters.type !== ALL_VALUE) params.set("type", filters.type);
  if (filters.criticality !== ALL_VALUE) params.set("criticality", filters.criticality);
  if (filters.origin !== ALL_VALUE) params.set("origin", filters.origin);
  if (filters.hasRiskAnalysis !== ALL_VALUE) params.set("hasRiskAnalysis", filters.hasRiskAnalysis);
  if (filters.hasInfoSecClause !== ALL_VALUE) params.set("hasInfoSecClause", filters.hasInfoSecClause);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  return params.toString();
}

interface InventoryListViewProps {
  areas: Area[];
  users: UserOption[];
  canManage: boolean;
}

export function InventoryListView({ areas, users, canManage }: InventoryListViewProps) {
  const t = useTranslations("Inventory");
  const criticalityT = useTranslations("Criticality");
  const api = useApi();

  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedInventory | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const loadItems = React.useCallback(
    (targetPage: number) => {
      return api
        .get<PaginatedInventory>(`/inventory?${buildQuery(filters, targetPage)}`)
        .then((result) => {
          setData(result);
          setError(null);
        })
        .catch(() => setError(t("loadError")));
    },
    [filters, api, t],
  );

  React.useEffect(() => {
    void loadItems(page);
  }, [page, loadItems]);

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  function updateFilter(key: keyof Filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== ALL_VALUE);

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    try {
      const params = new URLSearchParams(buildQuery(filters, 1));
      params.delete("page");
      params.delete("pageSize");
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("filtersTitle")}</CardTitle>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={exporting}>
                  {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                  {t("exportButton")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => handleExport("csv")}>{t("exportCsv")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleExport("json")}>{t("exportJson")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canManage && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus />
                {t("newButton")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">{t("columnStatus")}</span>
              <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filterStatusAll")}</SelectItem>
                  {INVENTORY_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`statuses.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">{t("fieldArea")}</span>
              <Select value={filters.areaId} onValueChange={(value) => updateFilter("areaId", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filterAreaAll")}</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">{t("fieldType")}</span>
              <Select value={filters.type} onValueChange={(value) => updateFilter("type", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filterTypeAll")}</SelectItem>
                  {SOFTWARE_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`types.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">{t("fieldCriticality")}</span>
              <Select
                value={filters.criticality}
                onValueChange={(value) => updateFilter("criticality", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filterCriticalityAll")}</SelectItem>
                  {CRITICALITY_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {criticalityT(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">{t("filterOrigin")}</span>
              <Select value={filters.origin} onValueChange={(value) => updateFilter("origin", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filterOriginAll")}</SelectItem>
                  <SelectItem value="HOMOLOGATED">{t("filterOriginHomologated")}</SelectItem>
                  <SelectItem value="MANUAL">{t("filterOriginManual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">{t("hasRiskAnalysisLabel")}</span>
              <Select
                value={filters.hasRiskAnalysis}
                onValueChange={(value) => updateFilter("hasRiskAnalysis", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filterComplianceAll")}</SelectItem>
                  <SelectItem value="true">{t("yes")}</SelectItem>
                  <SelectItem value="false">{t("no")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">{t("hasInfoSecClauseLabel")}</span>
              <Select
                value={filters.hasInfoSecClause}
                onValueChange={(value) => updateFilter("hasInfoSecClause", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>{t("filterComplianceAll")}</SelectItem>
                  <SelectItem value="true">{t("yes")}</SelectItem>
                  <SelectItem value="false">{t("no")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setPage(1);
                setFilters(EMPTY_FILTERS);
              }}
            >
              {t("clearFilters")}
            </Button>
          )}
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
                    <TableHead>{t("columnCompliance")}</TableHead>
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
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge
                            variant={item.hasRiskAnalysis ? "success" : "outline"}
                            className="text-[10px]"
                          >
                            ART
                          </Badge>
                          <Badge
                            variant={item.hasInfoSecClause ? "success" : "outline"}
                            className="text-[10px]"
                          >
                            InfoSec
                          </Badge>
                        </div>
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
    </div>
  );
}
