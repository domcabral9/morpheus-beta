"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/components/auth-provider";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { RoleSummary, WorkflowDefinitionAdmin, WorkflowStepAdmin } from "@/lib/workflow-admin-types";
import { AdminSectionGate } from "../../_components/section-gate";
import { StepFormDialog } from "./_components/step-form-dialog";

const basicSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean(),
});

type BasicFormInput = z.input<typeof basicSchema>;
type BasicFormOutput = z.output<typeof basicSchema>;

function BasicInfoForm({
  definition,
  onSaved,
}: {
  definition: WorkflowDefinitionAdmin;
  onSaved: () => void;
}) {
  const t = useTranslations("AdminWorkflow");
  const api = useApi();

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<BasicFormInput, unknown, BasicFormOutput>({
    resolver: zodResolver(basicSchema),
    defaultValues: { name: definition.name, isActive: definition.isActive },
  });

  async function onSubmit(values: BasicFormOutput) {
    try {
      await api.patch(`/workflow/admin/definitions/${definition.id}`, values);
      toast.success(t("definition.updateSuccess"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("definition.saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="def-name">{t("definition.fieldName")}</Label>
        <Input id="def-name" {...register("name")} aria-invalid={!!errors.name} />
      </div>
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Checkbox id="def-isActive" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Label htmlFor="def-isActive" className="font-normal">
          {t("definition.fieldIsActive")}
        </Label>
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function StepsSection({
  definition,
  roles,
  onChanged,
}: {
  definition: WorkflowDefinitionAdmin;
  roles: RoleSummary[];
  onChanged: () => void;
}) {
  const t = useTranslations("AdminWorkflow");
  const api = useApi();

  const [dialogState, setDialogState] = React.useState<
    { mode: "create" } | { mode: "edit"; step: WorkflowStepAdmin } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = React.useState<WorkflowStepAdmin | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/workflow/admin/steps/${deleteTarget.id}`);
      toast.success(t("step.deleteSuccess"));
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("step.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("step.title")}</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setDialogState({ mode: "create" })}>
          <Plus />
          {t("step.addButton")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {definition.steps.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("step.empty")}</p>
        )}
        {definition.steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <div className="flex flex-col">
              <span className="font-medium">
                {step.order}. {step.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("step.fieldResponsibleRole")}: {roleNameById.get(step.responsibleRoleId) ?? "—"} ·{" "}
                {t("step.fieldSlaHours")}: {step.slaHours}h
                {step.isOptional && ` · ${t("step.fieldIsOptional")}`}
                {step.requiresLgpd && ` · ${t("step.fieldRequiresLgpd")}`}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDialogState({ mode: "edit", step })}
              >
                <Pencil className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(step)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {dialogState?.mode === "create" && (
        <StepFormDialog
          definitionId={definition.id}
          roles={roles}
          mode="create"
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          onSaved={() => {
            setDialogState(null);
            onChanged();
          }}
        />
      )}
      {dialogState?.mode === "edit" && (
        <StepFormDialog
          definitionId={definition.id}
          roles={roles}
          mode="edit"
          step={dialogState.step}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          onSaved={() => {
            setDialogState(null);
            onChanged();
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("step.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("step.deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? t("saving") : t("step.deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function DefinitionDetailContent() {
  const t = useTranslations("AdminWorkflow");
  const params = useParams<{ id: string }>();
  const api = useApi();

  const [definition, setDefinition] = React.useState<WorkflowDefinitionAdmin | null | undefined>(undefined);
  const [roles, setRoles] = React.useState<RoleSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [settingDefault, setSettingDefault] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<WorkflowDefinitionAdmin>(`/workflow/admin/definitions/${params.id}`)
      .then((result) => {
        setDefinition(result);
        setError(null);
      })
      .catch(() => setError(t("definition.detailLoadError")));
  }, [api, params.id, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api.get<RoleSummary[]>("/roles").then(setRoles).catch(() => setRoles([]));
  }, [api]);

  async function handleSetDefault() {
    if (!definition) return;
    setSettingDefault(true);
    try {
      await api.post(`/workflow/admin/definitions/${definition.id}/set-default`);
      toast.success(t("definition.setDefaultSuccess"));
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("definition.setDefaultError"));
    } finally {
      setSettingDefault(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link href="/admin/workflow" className="text-sm text-muted-foreground hover:text-foreground">
        {t("back")}
      </Link>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && definition === undefined && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {definition === null && <p className="text-sm text-muted-foreground">{t("definition.notFound")}</p>}

      {definition && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {definition.name}
                {definition.isDefault && <Badge>{t("definition.default")}</Badge>}
              </CardTitle>
              {!definition.isDefault && (
                <Button type="button" size="sm" variant="outline" disabled={settingDefault} onClick={handleSetDefault}>
                  {settingDefault ? t("saving") : t("definition.setDefaultButton")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <BasicInfoForm definition={definition} onSaved={load} />
            </CardContent>
          </Card>

          <StepsSection definition={definition} roles={roles} onChanged={load} />
        </>
      )}
    </div>
  );
}

export default function AdminWorkflowDetailPage() {
  return (
    <AdminSectionGate permission="workflows:manage">
      <DefinitionDetailContent />
    </AdminSectionGate>
  );
}
