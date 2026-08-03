"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PendingInventoryApproval } from "@/lib/inventory-approval-types";
import { InventoryDecisionDialog } from "./inventory-decision-dialog";

export function InventoryApprovalsView() {
  const t = useTranslations("Approvals.inventoryTab");
  const criticalityT = useTranslations("Criticality");
  const api = useApi();

  const [items, setItems] = React.useState<PendingInventoryApproval[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<PendingInventoryApproval | null>(null);

  const loadPending = React.useCallback(() => {
    api
      .get<PendingInventoryApproval[]>("/inventory/pending-approvals")
      .then(setItems)
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  React.useEffect(() => {
    loadPending();
  }, [loadPending]);

  return (
    <>
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
                  <TableHead>{t("columnName")}</TableHead>
                  <TableHead>{t("columnVendor")}</TableHead>
                  <TableHead>{t("columnArea")}</TableHead>
                  <TableHead>{t("columnCriticality")}</TableHead>
                  <TableHead>{t("columnRequester")}</TableHead>
                  <TableHead>{t("columnSubmittedAt")}</TableHead>
                  <TableHead className="sr-only">{t("columnAction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelected(item)}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.vendor}</TableCell>
                    <TableCell className="text-muted-foreground">{item.area.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {criticalityT(item.criticality)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.approvalRequest?.requester.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
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

      <InventoryDecisionDialog
        item={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onDecided={(itemId) => {
          setItems((current) => current?.filter((item) => item.id !== itemId) ?? current);
          setSelected(null);
        }}
      />
    </>
  );
}
