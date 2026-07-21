"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InboxStepExecution } from "@/lib/workflow-types";
import { DecisionDialog } from "./_components/decision-dialog";

function isOverdue(slaDueAt: string | null): boolean {
  return slaDueAt !== null && new Date(slaDueAt).getTime() < Date.now();
}

export default function ApprovalsPage() {
  const t = useTranslations("Approvals");
  const criticalityT = useTranslations("Criticality");
  const user = useRequireAuth();
  const api = useApi();

  const [items, setItems] = React.useState<InboxStepExecution[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<InboxStepExecution | null>(null);

  const loadInbox = React.useCallback(() => {
    api
      .get<InboxStepExecution[]>("/workflow/inbox")
      .then(setItems)
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  React.useEffect(() => {
    if (!user) return;
    loadInbox();
  }, [user, loadInbox]);

  if (!user) return null;

  return (
    <>
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("cardTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-destructive">{error}</p>}

            {!error && !items && (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            )}

            {items && items.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            )}

            {items && items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columnSoftware")}</TableHead>
                    <TableHead>{t("columnStep")}</TableHead>
                    <TableHead>{t("columnCriticality")}</TableHead>
                    <TableHead>{t("columnSla")}</TableHead>
                    <TableHead className="sr-only">{t("columnAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((execution) => (
                    <TableRow
                      key={execution.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(execution)}
                    >
                      <TableCell className="font-medium">
                        {execution.assessmentWorkflowInstance.assessment.softwareName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {execution.workflowStep.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {criticalityT(execution.assessmentWorkflowInstance.assessment.criticality)}
                      </TableCell>
                      <TableCell>
                        {execution.slaDueAt ? (
                          <Badge variant={isOverdue(execution.slaDueAt) ? "destructive" : "outline"}>
                            {new Date(execution.slaDueAt).toLocaleDateString()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-primary">
                        {t("decideAction")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <DecisionDialog
        execution={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onDecided={(executionId) => {
          setItems((current) => current?.filter((item) => item.id !== executionId) ?? current);
          setSelected(null);
        }}
      />
    </>
  );
}
