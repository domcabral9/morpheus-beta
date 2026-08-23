"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { PaginatedSampleData, SampleDataItem } from "@/lib/sample-data-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminSectionGate } from "../_components/section-gate";

const PAGE_SIZE = 20;

function SampleDataContent() {
  const t = useTranslations("AdminSampleData");
  const api = useApi();

  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedSampleData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<SampleDataItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<PaginatedSampleData>(`/platform/sample-data?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, page, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/platform/sample-data/${deleteTarget.entityType}/${deleteTarget.id}`);
      toast.success(t("deleteSuccess"));
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
        </CardHeader>
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
                    <TableHead>{t("columnType")}</TableHead>
                    <TableHead>{t("columnName")}</TableHead>
                    <TableHead>{t("columnTenant")}</TableHead>
                    <TableHead>{t("columnCreatedBy")}</TableHead>
                    <TableHead>{t("columnCreatedAt")}</TableHead>
                    <TableHead className="text-right">{t("columnActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={`${item.entityType}-${item.id}`}>
                      <TableCell>
                        <Badge variant="secondary">{t(`entityTypes.${item.entityType}`)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.tenantName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.createdByName ?? t("unknownCreator")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                        >
                          {t("deleteButton")}
                        </Button>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("deleteConfirmDescription", { name: deleteTarget.name })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? t("deleting") : t("deleteButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminSampleDataPage() {
  return (
    <AdminSectionGate permission="platform:cross-tenant">
      <SampleDataContent />
    </AdminSectionGate>
  );
}
