"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import type { PermissionSummary, RoleAdmin, RoleDetail } from "@/lib/roles-admin-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoleCreateDialogProps {
  roles: RoleAdmin[];
  permissions: PermissionSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (role: RoleDetail) => void;
}

export function RoleCreateDialog({
  roles,
  permissions,
  open,
  onOpenChange,
  onCreated,
}: RoleCreateDialogProps) {
  const t = useTranslations("AdminRoles");
  const api = useApi();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [replicateMode, setReplicateMode] = React.useState(false);
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [sourceRoleId, setSourceRoleId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setName("");
    setDescription("");
    setReplicateMode(false);
    setSelectedKeys([]);
    setSourceRoleId("");
    setError(null);
  }

  function toggleKey(key: string, checked: boolean) {
    setSelectedKeys((current) => (checked ? [...current, key] : current.filter((k) => k !== key)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await api.post<RoleDetail>("/roles", {
        name,
        description: description || undefined,
        ...(replicateMode
          ? { replicateFromRoleId: sourceRoleId }
          : { permissionKeys: selectedKeys }),
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
            <Label htmlFor="new-role-name">{t("fieldName")}</Label>
            <Input
              id="new-role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-role-description">{t("fieldDescription")}</Label>
            <Textarea
              id="new-role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="replicate-role-toggle"
              checked={replicateMode}
              onCheckedChange={(checked) => setReplicateMode(checked === true)}
            />
            <Label htmlFor="replicate-role-toggle" className="font-normal">
              {t("replicateToggle")}
            </Label>
          </div>

          {replicateMode ? (
            <div className="flex flex-col gap-2">
              <Select value={sourceRoleId} onValueChange={setSourceRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("replicateFromPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("permissionsLabel")}</span>
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                {permissions.map((permission) => (
                  <div key={permission.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`new-role-permission-${permission.key}`}
                      checked={selectedKeys.includes(permission.key)}
                      onCheckedChange={(checked) => toggleKey(permission.key, checked === true)}
                    />
                    <Label
                      htmlFor={`new-role-permission-${permission.key}`}
                      className="font-normal"
                      title={permission.description}
                    >
                      {permission.key}
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
              disabled={pending || !name || (replicateMode && !sourceRoleId)}
            >
              {pending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
