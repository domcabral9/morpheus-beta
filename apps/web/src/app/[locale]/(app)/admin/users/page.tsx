"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RoleSummary, UserAdmin } from "@/lib/users-admin-types";
import { AdminSectionGate } from "../_components/section-gate";
import { RoleAssignmentDialog } from "./_components/role-assignment-dialog";

function UsersAdminContent() {
  const t = useTranslations("AdminUsers");
  const api = useApi();

  const [users, setUsers] = React.useState<UserAdmin[] | null>(null);
  const [roles, setRoles] = React.useState<RoleSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [managingUser, setManagingUser] = React.useState<UserAdmin | null>(null);

  const loadUsers = React.useCallback(() => {
    api
      .get<UserAdmin[]>("/users")
      .then((result) => {
        setUsers(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  React.useEffect(() => {
    api.get<RoleSummary[]>("/roles").then(setRoles).catch(() => setRoles([]));
  }, [api]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !users && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {users && users.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnName")}</TableHead>
                  <TableHead>{t("columnEmail")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                  <TableHead>{t("columnRoles")}</TableHead>
                  <TableHead className="sr-only">{t("columnAction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "success" : "outline"}>
                        {user.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.userRoles.length === 0 && (
                          <span className="text-xs text-muted-foreground">{t("noRoles")}</span>
                        )}
                        {user.userRoles.map((link) => (
                          <Badge key={link.role.id} variant="secondary">
                            {link.role.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setManagingUser(user)}>
                        {t("manageRolesButton")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {managingUser && (
        <RoleAssignmentDialog
          user={managingUser}
          roles={roles}
          open={!!managingUser}
          onOpenChange={(open) => !open && setManagingUser(null)}
          onChanged={(updated) => {
            setManagingUser(updated);
            setUsers((current) =>
              current?.map((user) => (user.id === updated.id ? updated : user)) ?? current,
            );
          }}
        />
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminSectionGate permission="users:manage">
      <UsersAdminContent />
    </AdminSectionGate>
  );
}
