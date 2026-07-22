"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { useAuth, ApiError } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RoleSummary, UserAdmin } from "@/lib/users-admin-types";
import { AdminSectionGate } from "../_components/section-gate";
import { RoleAssignmentDialog } from "./_components/role-assignment-dialog";
import { CreateUserDialog } from "./_components/create-user-dialog";

function UsersAdminContent() {
  const t = useTranslations("AdminUsers");
  const api = useApi();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = React.useState<UserAdmin[] | null>(null);
  const [roles, setRoles] = React.useState<RoleSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [managingUser, setManagingUser] = React.useState<UserAdmin | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

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

  async function handleToggleActive(user: UserAdmin) {
    setTogglingId(user.id);
    try {
      const updated = await api.patch<UserAdmin>(`/users/${user.id}/active`, {
        isActive: !user.isActive,
      });
      setUsers((current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)) ?? current,
      );
      toast.success(updated.isActive ? t("activateSuccess") : t("deactivateSuccess"));
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : t(user.isActive ? "deactivateError" : "activateError"),
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("newUserButton")}
        </Button>
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
                {users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
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
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setManagingUser(user)}
                          >
                            {t("manageRolesButton")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={togglingId === user.id || (isSelf && user.isActive)}
                            title={isSelf && user.isActive ? t("cannotDeactivateSelf") : undefined}
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.isActive ? t("deactivateButton") : t("activateButton")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <CreateUserDialog
        users={users ?? []}
        roles={roles}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          setUsers((current) => (current ? [...current, created] : [created]));
        }}
      />
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
