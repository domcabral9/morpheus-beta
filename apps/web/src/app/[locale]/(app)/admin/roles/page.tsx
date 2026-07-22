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
import type { PermissionSummary, RoleAdmin } from "@/lib/roles-admin-types";
import { AdminSectionGate } from "../_components/section-gate";
import { RoleCreateDialog } from "./_components/role-create-dialog";

function RolesAdminContent() {
  const t = useTranslations("AdminRoles");
  const api = useApi();

  const [roles, setRoles] = React.useState<RoleAdmin[] | null>(null);
  const [permissions, setPermissions] = React.useState<PermissionSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<RoleAdmin[]>("/roles/admin")
      .then((result) => {
        setRoles(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api.get<PermissionSummary[]>("/roles/permissions").then(setPermissions).catch(() => setPermissions([]));
  }, [api]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("newRoleButton")}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !roles && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {roles && roles.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnName")}</TableHead>
                  <TableHead>{t("columnDescription")}</TableHead>
                  <TableHead>{t("columnPermissions")}</TableHead>
                  <TableHead>{t("columnUsers")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/roles/${role.id}`} className="hover:underline">
                        {role.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{role.description ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{role.permissionCount}</TableCell>
                    <TableCell className="text-muted-foreground">{role.userCount}</TableCell>
                    <TableCell>
                      {role.isSystem && <Badge variant="secondary">{t("systemBadge")}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <RoleCreateDialog
        roles={roles ?? []}
        permissions={permissions}
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

export default function AdminRolesPage() {
  return (
    <AdminSectionGate permission="roles:manage">
      <RolesAdminContent />
    </AdminSectionGate>
  );
}
