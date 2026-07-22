"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PermissionSummary, RoleDetail } from "@/lib/roles-admin-types";
import { AdminSectionGate } from "../../_components/section-gate";

const basicSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

type BasicFormInput = z.input<typeof basicSchema>;
type BasicFormOutput = z.output<typeof basicSchema>;

function BasicInfoForm({ role, onSaved }: { role: RoleDetail; onSaved: () => void }) {
  const t = useTranslations("AdminRoles");
  const api = useApi();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<BasicFormInput, unknown, BasicFormOutput>({
    resolver: zodResolver(basicSchema),
    defaultValues: { name: role.name, description: role.description ?? "" },
  });

  async function onSubmit(values: BasicFormOutput) {
    try {
      await api.patch(`/roles/${role.id}`, values);
      toast.success(t("updateSuccess"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("updateError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="role-name">{t("fieldName")}</Label>
        <Input
          id="role-name"
          {...register("name")}
          aria-invalid={!!errors.name}
          disabled={role.isSystem}
          title={role.isSystem ? t("cannotRenameSystem") : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role-description">{t("fieldDescription")}</Label>
        <Textarea id="role-description" {...register("description")} />
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function PermissionsSection({
  role,
  catalog,
  onChanged,
}: {
  role: RoleDetail;
  catalog: PermissionSummary[];
  onChanged: () => void;
}) {
  const t = useTranslations("AdminRoles");
  const api = useApi();

  const [selectedKeys, setSelectedKeys] = React.useState<string[]>(
    role.permissions.map((permission) => permission.key),
  );
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    // Ressincroniza o checklist local com o servidor depois de um reload
    // (ex.: após salvar) - `role` é um objeto novo a cada fetch, então isto
    // não roda a cada render, só quando o papel realmente é recarregado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedKeys(role.permissions.map((permission) => permission.key));
  }, [role]);

  function toggleKey(key: string, checked: boolean) {
    setSelectedKeys((current) => (checked ? [...current, key] : current.filter((k) => k !== key)));
  }

  async function handleSave() {
    setPending(true);
    try {
      await api.patch(`/roles/${role.id}/permissions`, { permissionKeys: selectedKeys });
      toast.success(t("permissionsSaveSuccess"));
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("permissionsSaveError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("permissionsLabel")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {catalog.map((permission) => (
            <div key={permission.key} className="flex items-center gap-2">
              <Checkbox
                id={`role-permission-${permission.key}`}
                checked={selectedKeys.includes(permission.key)}
                onCheckedChange={(checked) => toggleKey(permission.key, checked === true)}
              />
              <Label
                htmlFor={`role-permission-${permission.key}`}
                className="font-normal"
                title={permission.description}
              >
                {permission.key}
              </Label>
            </div>
          ))}
        </div>
        <div>
          <Button type="button" disabled={pending} onClick={handleSave}>
            {pending ? t("saving") : t("permissionsSaveButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RoleDetailContent() {
  const t = useTranslations("AdminRoles");
  const params = useParams<{ id: string }>();
  const api = useApi();
  const router = useRouter();

  const [role, setRole] = React.useState<RoleDetail | null | undefined>(undefined);
  const [catalog, setCatalog] = React.useState<PermissionSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<RoleDetail>(`/roles/${params.id}`)
      .then((result) => {
        setRole(result);
        setError(null);
      })
      .catch(() => setError(t("detailLoadError")));
  }, [api, params.id, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api.get<PermissionSummary[]>("/roles/permissions").then(setCatalog).catch(() => setCatalog([]));
  }, [api]);

  async function handleDelete() {
    if (!role) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${role.id}`);
      toast.success(t("deleteSuccess"));
      router.push("/admin/roles");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link href="/admin/roles" className="text-sm text-muted-foreground hover:text-foreground">
        {t("back")}
      </Link>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && role === undefined && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {role === null && <p className="text-sm text-muted-foreground">{t("notFound")}</p>}

      {role && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {role.name}
                {role.isSystem && <Badge variant="secondary">{t("systemBadge")}</Badge>}
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={role.isSystem}
                title={role.isSystem ? t("cannotDeleteSystem") : undefined}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
                {t("deleteButton")}
              </Button>
            </CardHeader>
            <CardContent>
              <BasicInfoForm role={role} onSaved={load} />
            </CardContent>
          </Card>

          <PermissionsSection role={role} catalog={catalog} onChanged={load} />
        </>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? t("saving") : t("deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminRoleDetailPage() {
  return (
    <AdminSectionGate permission="roles:manage">
      <RoleDetailContent />
    </AdminSectionGate>
  );
}
