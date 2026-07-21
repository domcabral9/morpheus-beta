"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { X } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { RoleSummary, UserAdmin } from "@/lib/users-admin-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoleAssignmentDialogProps {
  user: UserAdmin;
  roles: RoleSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (user: UserAdmin) => void;
}

export function RoleAssignmentDialog({
  user,
  roles,
  open,
  onOpenChange,
  onChanged,
}: RoleAssignmentDialogProps) {
  const t = useTranslations("AdminUsers");
  const api = useApi();

  const [selectedRoleId, setSelectedRoleId] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const assignedRoleIds = new Set(user.userRoles.map((link) => link.role.id));
  const availableRoles = roles.filter((role) => !assignedRoleIds.has(role.id));

  async function handleAssign() {
    if (!selectedRoleId) return;
    setPending(true);
    try {
      const updated = await api.post<UserAdmin>(`/users/${user.id}/roles`, { roleId: selectedRoleId });
      toast.success(t("assignSuccess"));
      setSelectedRoleId("");
      onChanged(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("assignError"));
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(roleId: string) {
    setPending(true);
    try {
      await api.delete(`/users/${user.id}/roles/${roleId}`);
      toast.success(t("removeSuccess"));
      onChanged({
        ...user,
        userRoles: user.userRoles.filter((link) => link.role.id !== roleId),
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("removeError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rolesDialogTitle", { name: user.name })}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("currentRoles")}</span>
            {user.userRoles.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noRoles")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {user.userRoles.map((link) => (
                <Badge key={link.role.id} variant="secondary" className="gap-1 pr-1">
                  {link.role.name}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleRemove(link.role.id)}
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label={t("removeRoleAria", { role: link.role.name })}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("addRole")}</span>
            <div className="flex gap-2">
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={pending}>
                <SelectTrigger>
                  <SelectValue placeholder={t("addRolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" disabled={!selectedRoleId || pending} onClick={handleAssign}>
                {t("addRoleButton")}
              </Button>
            </div>
            {availableRoles.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("allRolesAssigned")}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
