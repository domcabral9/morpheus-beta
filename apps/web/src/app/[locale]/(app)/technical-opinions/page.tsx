"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Download, Eye, Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import type { PaginatedTechnicalOpinions } from "@/lib/technical-opinion-types";
import type { UserOption } from "@/lib/user-picker-types";

const PAGE_SIZE = 20;
const ALL_USERS_VALUE = "__all__";

interface FiltersState {
  number: string;
  classificationLabel: string;
  issuedById: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FiltersState = {
  number: "",
  classificationLabel: "",
  issuedById: ALL_USERS_VALUE,
  from: "",
  to: "",
};

function buildQuery(filters: FiltersState, page: number): string {
  const params = new URLSearchParams();
  if (filters.number.trim()) params.set("number", filters.number.trim());
  if (filters.classificationLabel.trim()) {
    params.set("classificationLabel", filters.classificationLabel.trim());
  }
  if (filters.issuedById !== ALL_USERS_VALUE) params.set("issuedById", filters.issuedById);
  if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59.999`).toISOString());
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  return params.toString();
}

function classificationBadgeVariant(label: string): "success" | "destructive" | "warning" | "outline" {
  if (label === "Homologado") return "success";
  if (label === "Rejeitado") return "destructive";
  if (label === "Aguardando Ajustes") return "warning";
  return "outline";
}

export default function TechnicalOpinionsPage() {
  const t = useTranslations("TechnicalOpinions");
  const api = useApi();

  const [filters, setFilters] = React.useState<FiltersState>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<PaginatedTechnicalOpinions | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [viewingId, setViewingId] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewNumber, setPreviewNumber] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<PaginatedTechnicalOpinions>(`/technical-opinions?${buildQuery(filters, page)}`)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [filters, page, api, t]);

  React.useEffect(() => {
    api.get<UserOption[]>("/users").then(setUsers).catch(() => {});
  }, [api]);

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  async function handleDownload(id: string, number: string) {
    setDownloadingId(id);
    try {
      const blob = await api.getBlob(`/technical-opinions/${id}/download`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t("downloadError"));
    } finally {
      setDownloadingId(null);
    }
  }

  /** Visualiza o PDF num dialog embutido (iframe), não numa aba nova: o
   * Chromium bloqueia navegar uma janela `window.open()`/`<a target="_blank">`
   * pra uma URL `blob:` criada depois de um `await` (proteção contra blob
   * URLs vazando entre contextos de navegação) - um `<iframe>` dentro do
   * próprio documento não esbarra nessa restrição. */
  async function handleView(id: string, number: string) {
    setViewingId(id);
    try {
      const blob = await api.getBlob(`/technical-opinions/${id}/download`);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewNumber(number);
    } catch {
      setError(t("viewError"));
    } finally {
      setViewingId(null);
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewNumber(null);
  }

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
              <Label htmlFor="number">{t("filterNumber")}</Label>
              <Input
                id="number"
                placeholder={t("filterNumberPlaceholder")}
                value={filters.number}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, number: event.target.value }));
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="classificationLabel">{t("filterClassification")}</Label>
              <Input
                id="classificationLabel"
                placeholder={t("filterClassificationPlaceholder")}
                value={filters.classificationLabel}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, classificationLabel: event.target.value }));
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="issuedById">{t("filterIssuedBy")}</Label>
              <Select
                value={filters.issuedById}
                onValueChange={(value) => {
                  setPage(1);
                  setFilters((current) => ({ ...current, issuedById: value }));
                }}
              >
                <SelectTrigger id="issuedById">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_USERS_VALUE}>{t("filterIssuedByAll")}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
          </div>

          {(filters.number ||
            filters.classificationLabel ||
            filters.issuedById !== ALL_USERS_VALUE ||
            filters.from ||
            filters.to) && (
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
                    <TableHead>{t("columnNumber")}</TableHead>
                    <TableHead>{t("columnSoftware")}</TableHead>
                    <TableHead>{t("columnClassification")}</TableHead>
                    <TableHead>{t("columnIssuedAt")}</TableHead>
                    <TableHead>{t("columnIssuedBy")}</TableHead>
                    <TableHead className="text-right">{t("columnActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((opinion) => (
                    <TableRow key={opinion.id}>
                      <TableCell className="font-medium">{opinion.number}</TableCell>
                      <TableCell>
                        <Link
                          href={`/assessments/${opinion.assessmentVersion.assessment.id}`}
                          className="hover:underline"
                        >
                          {opinion.assessmentVersion.assessment.softwareName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={classificationBadgeVariant(opinion.classificationLabel)}>
                          {opinion.classificationLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(opinion.issuedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{opinion.issuedBy.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={viewingId === opinion.id}
                            onClick={() => handleView(opinion.id, opinion.number)}
                          >
                            {viewingId === opinion.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                            {t("view")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === opinion.id}
                            onClick={() => handleDownload(opinion.id, opinion.number)}
                          >
                            {downloadingId === opinion.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                            {t("download")}
                          </Button>
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

      <Dialog open={previewUrl !== null} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="flex h-[85vh] max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle>{previewNumber}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              title={previewNumber ?? t("view")}
              className="flex-1 rounded-md border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
