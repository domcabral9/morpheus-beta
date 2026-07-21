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
import type { WorkflowDefinitionAdmin } from "@/lib/workflow-admin-types";
import { AdminSectionGate } from "../_components/section-gate";
import { DefinitionCreateDialog } from "./_components/definition-create-dialog";

function WorkflowAdminContent() {
  const t = useTranslations("AdminWorkflow");
  const api = useApi();

  const [definitions, setDefinitions] = React.useState<WorkflowDefinitionAdmin[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<WorkflowDefinitionAdmin[]>("/workflow/admin/definitions")
      .then((result) => {
        setDefinitions(result);
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
          {t("definition.newButton")}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !definitions && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {definitions && definitions.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("definition.empty")}</p>
      )}

      {definitions && definitions.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("definition.columnName")}</TableHead>
                  <TableHead>{t("definition.columnSteps")}</TableHead>
                  <TableHead>{t("definition.columnStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definitions.map((definition) => (
                  <TableRow key={definition.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/workflow/${definition.id}`} className="hover:underline">
                        {definition.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{definition.steps.length}</TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      {definition.isDefault && <Badge>{t("definition.default")}</Badge>}
                      <Badge variant={definition.isActive ? "success" : "outline"}>
                        {definition.isActive ? t("definition.active") : t("definition.inactive")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DefinitionCreateDialog
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

export default function AdminWorkflowPage() {
  return (
    <AdminSectionGate permission="workflows:manage">
      <WorkflowAdminContent />
    </AdminSectionGate>
  );
}
