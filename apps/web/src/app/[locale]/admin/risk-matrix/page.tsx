"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RiskMatrixConfigSummary } from "@/lib/risk-matrix-admin-types";
import { AdminSectionGate } from "../_components/section-gate";
import { ConfigCreateDialog } from "./_components/config-create-dialog";

function RiskMatrixAdminContent() {
  const t = useTranslations("AdminRiskMatrix");
  const api = useApi();

  const [configs, setConfigs] = React.useState<RiskMatrixConfigSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<RiskMatrixConfigSummary[]>("/risk-matrix/admin/configs")
      .then((result) => {
        setConfigs(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("config.newButton")}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !configs && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {configs && configs.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("config.empty")}</p>
      )}

      {configs && configs.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("config.columnName")}</TableHead>
                  <TableHead>{t("config.columnVersion")}</TableHead>
                  <TableHead>{t("config.columnMinApprovalScore")}</TableHead>
                  <TableHead>{t("config.columnStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/risk-matrix/${config.id}`} className="hover:underline">
                        {config.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">v{config.version}</TableCell>
                    <TableCell className="text-muted-foreground">{config.minApprovalScore}</TableCell>
                    <TableCell>
                      <Badge variant={config.isActive ? "success" : "outline"}>
                        {config.isActive ? t("config.active") : t("config.inactive")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ConfigCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
      />
    </div>
  );
}

export default function AdminRiskMatrixPage() {
  return (
    <AdminSectionGate permission="risk-matrix:manage">
      <RiskMatrixAdminContent />
    </AdminSectionGate>
  );
}
