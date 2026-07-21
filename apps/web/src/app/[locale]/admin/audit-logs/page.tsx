"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { AUDIT_ACTIONS, type AuditAction, type PaginatedAuditLogs } from "@/lib/audit-log-types";
import { AdminSectionGate } from "../_components/section-gate";

const PAGE_SIZE = 20;
const ALL_ACTIONS_VALUE = "__all__";

interface FiltersState {
  entityType: string;
  action: AuditAction | typeof ALL_ACTIONS_VALUE;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FiltersState = {
  entityType: "",
  action: ALL_ACTIONS_VALUE,
  from: "",
  to: "",
};

function buildQuery(filters: FiltersState, page: number): string {
  const params = new URLSearchParams();
  if (filters.entityType.trim()) params.set("entityType", filters.entityType.trim());
  if (filters.action !== ALL_ACTIONS_VALUE) params.set("action", filters.action);
  if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString());
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  return params.toString();
}

function AuditLogsContent() {
  const t = useTranslations("AuditLogs");
  const api = useApi();

  const [filters, setFilters] = React.useState<FiltersState>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedAuditLogs | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<PaginatedAuditLogs>(`/audit-logs?${buildQuery(filters, page)}`)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [filters, page, api, t]);

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("filtersTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="entityType">{t("filterEntityType")}</Label>
              <Input
                id="entityType"
                placeholder={t("filterEntityTypePlaceholder")}
                value={filters.entityType}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, entityType: event.target.value }));
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="action">{t("filterAction")}</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    action: value as FiltersState["action"],
                  }));
                }}
              >
                <SelectTrigger id="action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACTIONS_VALUE}>{t("filterActionAll")}</SelectItem>
                  {AUDIT_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {t(`actions.${action}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="from">{t("filterFrom")}</Label>
              <Input
                id="from"
                type="date"
                value={filters.from}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, from: event.target.value }));
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="to">{t("filterTo")}</Label>
              <Input
                id="to"
                type="date"
                value={filters.to}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, to: event.target.value }));
                }}
              />
            </div>
          </div>

          {(filters.entityType || filters.action !== ALL_ACTIONS_VALUE || filters.from || filters.to) && (
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
                    <TableHead>{t("columnDate")}</TableHead>
                    <TableHead>{t("columnAction")}</TableHead>
                    <TableHead>{t("columnEntity")}</TableHead>
                    <TableHead>{t("columnUser")}</TableHead>
                    <TableHead>{t("columnIp")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">{t(`actions.${log.action}`)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.entityType}
                        {log.entityId ? ` #${log.entityId.slice(-8)}` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.user ? log.user.name : t("systemUser")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
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
  );
}

export default function AdminAuditLogsPage() {
  return (
    <AdminSectionGate permission="audit:view">
      <AuditLogsContent />
    </AdminSectionGate>
  );
}
