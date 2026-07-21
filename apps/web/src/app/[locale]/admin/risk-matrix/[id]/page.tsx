"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
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
import type {
  RiskClassificationAdmin,
  RiskLevel,
  RiskMatrixConfigDetail,
} from "@/lib/risk-matrix-admin-types";
import { AdminSectionGate } from "../../_components/section-gate";
import { LevelFormDialog, type LevelAxis } from "./_components/level-form-dialog";
import { ClassificationFormDialog } from "./_components/classification-form-dialog";
import { HeatmapEditor } from "./_components/heatmap-editor";

const basicSchema = z.object({
  name: z.string().min(1),
  minApprovalScore: z.coerce.number().min(0).max(5),
});

type BasicFormInput = z.input<typeof basicSchema>;
type BasicFormOutput = z.output<typeof basicSchema>;

const AXIS_PATH: Record<LevelAxis, string> = {
  probability: "probability-levels",
  impact: "impact-levels",
};

function BasicInfoForm({
  config,
  onSaved,
}: {
  config: RiskMatrixConfigDetail;
  onSaved: () => void;
}) {
  const t = useTranslations("AdminRiskMatrix");
  const api = useApi();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<BasicFormInput, unknown, BasicFormOutput>({
    resolver: zodResolver(basicSchema),
    defaultValues: { name: config.name, minApprovalScore: Number(config.minApprovalScore) },
  });

  async function onSubmit(values: BasicFormOutput) {
    try {
      await api.patch(`/risk-matrix/admin/configs/${config.id}`, values);
      toast.success(t("config.updateSuccess"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("config.saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cfg-name">{t("config.fieldName")}</Label>
          <Input id="cfg-name" {...register("name")} aria-invalid={!!errors.name} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cfg-minApprovalScore">{t("config.fieldMinApprovalScore")}</Label>
          <Input id="cfg-minApprovalScore" type="number" step="0.01" {...register("minApprovalScore")} />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function LevelsSection({
  axis,
  config,
  onChanged,
}: {
  axis: LevelAxis;
  config: RiskMatrixConfigDetail;
  onChanged: () => void;
}) {
  const t = useTranslations("AdminRiskMatrix");
  const api = useApi();
  const levels = axis === "probability" ? config.probabilityLevels : config.impactLevels;

  const [dialogState, setDialogState] = React.useState<
    { mode: "create" } | { mode: "edit"; level: RiskLevel } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RiskLevel | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/risk-matrix/admin/${AXIS_PATH[axis]}/${deleteTarget.id}`);
      toast.success(t("level.deleteSuccess"));
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("level.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t(axis === "probability" ? "probabilityLevels.title" : "impactLevels.title")}
        </CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setDialogState({ mode: "create" })}>
          <Plus />
          {t("level.addButton")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {levels.length === 0 && <p className="text-sm text-muted-foreground">{t("level.empty")}</p>}
        {levels.map((level) => (
          <div key={level.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <div className="flex flex-col">
              <span className="font-medium">{level.label}</span>
              <span className="text-xs text-muted-foreground">
                {t("level.fieldMinScore")}: {level.minScore} · {t("level.fieldMaxScore")}: {level.maxScore}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDialogState({ mode: "edit", level })}
              >
                <Pencil className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(level)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {dialogState?.mode === "create" && (
        <LevelFormDialog
          axis={axis}
          configId={config.id}
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
        <LevelFormDialog
          axis={axis}
          configId={config.id}
          mode="edit"
          level={dialogState.level}
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
            <AlertDialogTitle>{t("level.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("level.deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? t("saving") : t("level.deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ClassificationsSection({
  config,
  onChanged,
}: {
  config: RiskMatrixConfigDetail;
  onChanged: () => void;
}) {
  const t = useTranslations("AdminRiskMatrix");
  const api = useApi();

  const [dialogState, setDialogState] = React.useState<
    { mode: "create" } | { mode: "edit"; classification: RiskClassificationAdmin } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RiskClassificationAdmin | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/risk-matrix/admin/classifications/${deleteTarget.id}`);
      toast.success(t("classification.deleteSuccess"));
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("classification.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("classification.title")}</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setDialogState({ mode: "create" })}>
          <Plus />
          {t("classification.addButton")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {config.riskClassifications.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("classification.empty")}</p>
        )}
        {config.riskClassifications.map((classification) => (
          <div
            key={classification.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              <span
                className="size-4 shrink-0 rounded-full border"
                style={{ backgroundColor: classification.color }}
              />
              <div className="flex flex-col">
                <span className="font-medium">{classification.label}</span>
                <span className="text-xs text-muted-foreground">
                  {t("classification.fieldMinScore")}: {classification.minScore} ·{" "}
                  {t("classification.fieldMaxScore")}: {classification.maxScore}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDialogState({ mode: "edit", classification })}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(classification)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {dialogState?.mode === "create" && (
        <ClassificationFormDialog
          configId={config.id}
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
        <ClassificationFormDialog
          configId={config.id}
          mode="edit"
          classification={dialogState.classification}
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
            <AlertDialogTitle>{t("classification.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("classification.deleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? t("saving") : t("classification.deleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ConfigDetailContent() {
  const t = useTranslations("AdminRiskMatrix");
  const params = useParams<{ id: string }>();
  const api = useApi();

  const [config, setConfig] = React.useState<RiskMatrixConfigDetail | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [activating, setActivating] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<RiskMatrixConfigDetail>(`/risk-matrix/admin/configs/${params.id}`)
      .then((result) => {
        setConfig(result);
        setError(null);
      })
      .catch(() => setError(t("config.detailLoadError")));
  }, [api, params.id, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleActivate() {
    if (!config) return;
    setActivating(true);
    try {
      await api.post(`/risk-matrix/admin/configs/${config.id}/activate`);
      toast.success(t("config.activateSuccess"));
      setActivateOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("config.activateError"));
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link href="/admin/risk-matrix" className="text-sm text-muted-foreground hover:text-foreground">
        {t("back")}
      </Link>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && config === undefined && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {config === null && <p className="text-sm text-muted-foreground">{t("config.notFound")}</p>}

      {config && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {config.name}
                <Badge variant={config.isActive ? "success" : "outline"}>
                  {config.isActive ? t("config.active") : t("config.inactive")}
                </Badge>
              </CardTitle>
              {!config.isActive && (
                <Button type="button" size="sm" onClick={() => setActivateOpen(true)}>
                  {t("config.activateButton")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <BasicInfoForm config={config} onSaved={load} />
            </CardContent>
          </Card>

          <LevelsSection axis="probability" config={config} onChanged={load} />
          <LevelsSection axis="impact" config={config} onChanged={load} />
          <ClassificationsSection config={config} onChanged={load} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("heatmap.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <HeatmapEditor config={config} onChanged={load} />
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("config.activateConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("config.activateConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={activating} onClick={handleActivate}>
              {activating ? t("saving") : t("config.activateConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminRiskMatrixDetailPage() {
  return (
    <AdminSectionGate permission="risk-matrix:manage">
      <ConfigDetailContent />
    </AdminSectionGate>
  );
}
