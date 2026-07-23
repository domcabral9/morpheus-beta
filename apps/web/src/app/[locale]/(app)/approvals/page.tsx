"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BulkDecideResult, InboxStepExecution } from "@/lib/workflow-types";
import { DecisionDialog } from "./_components/decision-dialog";
import { BulkDecisionDialog } from "./_components/bulk-decision-dialog";

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
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);

  const loadInbox = React.useCallback(() => {
    api
      .get<InboxStepExecution[]>("/workflow/inbox")
      .then((result) => {
        setItems(result);
        setSelectedIds(new Set());
      })
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  React.useEffect(() => {
    if (!user) return;
    loadInbox();
  }, [user, loadInbox]);

  if (!user) return null;

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(items?.map((item) => item.id) ?? []) : new Set());
  }

  const selectedExecutions = (items ?? []).filter((item) => selectedIds.has(item.id));
  const allSelected = !!items && items.length > 0 && selectedIds.size === items.length;

  return (
    <>
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("cardTitle")}</CardTitle>
            {selectedIds.size > 0 && (
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                {t("bulkDecideButton", { count: selectedIds.size })}
              </Button>
            )}
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                        aria-label={t("selectAll")}
                      />
                    </TableHead>
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
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(execution.id)}
                          onCheckedChange={(checked) => toggleSelected(execution.id, checked === true)}
                          aria-label={t("selectRow")}
                        />
                      </TableCell>
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
          setSelectedIds((current) => {
            const next = new Set(current);
            next.delete(executionId);
            return next;
          });
          setSelected(null);
        }}
      />

      {bulkOpen && (
        <BulkDecisionDialog
          executions={selectedExecutions}
          onOpenChange={(open) => {
            if (!open) setBulkOpen(false);
          }}
          onDecided={(results: BulkDecideResult[]) => {
            const succeededIds = new Set(results.filter((result) => result.success).map((result) => result.stepExecutionId));
            setItems((current) => current?.filter((item) => !succeededIds.has(item.id)) ?? current);
            setSelectedIds((current) => {
              const next = new Set(current);
              succeededIds.forEach((id) => next.delete(id));
              return next;
            });
            setBulkOpen(false);
          }}
        />
      )}
    </>
  );
}
