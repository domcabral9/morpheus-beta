"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { RoleSummary, UserAdmin } from "@/lib/users-admin-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateUserDialogProps {
  users: UserAdmin[];
  roles: RoleSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: UserAdmin) => void;
}

export function CreateUserDialog({
  users,
  roles,
  open,
  onOpenChange,
  onCreated,
}: CreateUserDialogProps) {
  const t = useTranslations("AdminUsers");
  const api = useApi();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [replicateMode, setReplicateMode] = React.useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);
  const [sourceUserId, setSourceUserId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setName("");
    setEmail("");
    setReplicateMode(false);
    setSelectedRoleIds([]);
    setSourceUserId("");
    setError(null);
  }

  function toggleRole(roleId: string, checked: boolean) {
    setSelectedRoleIds((current) =>
      checked ? [...current, roleId] : current.filter((id) => id !== roleId),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await api.post<UserAdmin>("/users", {
        name,
        email,
        ...(replicateMode
          ? { replicateRolesFromUserId: sourceUserId }
          : { roleIds: selectedRoleIds }),
      });
      toast.success(t("createSuccess"));
      onCreated(created);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("createError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createDialogTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-name">{t("fieldName")}</Label>
            <Input
              id="new-user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-email">{t("fieldEmail")}</Label>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="replicate-roles-toggle"
              checked={replicateMode}
              onCheckedChange={(checked) => setReplicateMode(checked === true)}
            />
            <Label htmlFor="replicate-roles-toggle" className="font-normal">
              {t("replicateRolesToggle")}
            </Label>
          </div>

          {replicateMode ? (
            <div className="flex flex-col gap-2">
              <Select value={sourceUserId} onValueChange={setSourceUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("replicateFromPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("roleModeManual")}</span>
              <div className="flex flex-col gap-2">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`new-user-role-${role.id}`}
                      checked={selectedRoleIds.includes(role.id)}
                      onCheckedChange={(checked) => toggleRole(role.id, checked === true)}
                    />
                    <Label htmlFor={`new-user-role-${role.id}`} className="font-normal">
                      {role.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="submit"
              disabled={pending || !name || !email || (replicateMode && !sourceUserId)}
            >
              {pending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
