"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import type { VendorTierConfig } from "@/lib/vendor-tier-config-types";
import { AdminSectionGate } from "../../_components/section-gate";

const thresholdSchema = z.object({
  id: z.string(),
  tier: z.number(),
  label: z.string().min(1),
  color: z.string().min(1),
  minScore: z.coerce.number(),
  maxScore: z.coerce.number(),
  baseReassessmentMonths: z.coerce.number().int().min(1),
});

const thresholdsFormSchema = z.object({ thresholds: z.array(thresholdSchema) });

type ThresholdsFormInput = z.input<typeof thresholdsFormSchema>;
type ThresholdsFormOutput = z.output<typeof thresholdsFormSchema>;

function ThresholdsForm({ config, onSaved }: { config: VendorTierConfig; onSaved: () => void }) {
  const t = useTranslations("AdminVendorTierConfig");
  const api = useApi();

  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = useForm<ThresholdsFormInput, unknown, ThresholdsFormOutput>({
    resolver: zodResolver(thresholdsFormSchema),
    values: { thresholds: [...config.thresholds].sort((a, b) => a.tier - b.tier) },
  });

  const { fields } = useFieldArray({ control, name: "thresholds" });

  async function onSubmit(values: ThresholdsFormOutput) {
    try {
      await Promise.all(
        values.thresholds.map((threshold) =>
          api.post(`/vendors/admin/tier-configs/${config.id}/thresholds`, {
            tier: threshold.tier,
            label: threshold.label,
            color: threshold.color,
            minScore: threshold.minScore,
            maxScore: threshold.maxScore,
            baseReassessmentMonths: threshold.baseReassessmentMonths,
          }),
        ),
      );
      toast.success(t("threshold.saveSuccess"));
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("threshold.saveError"));
    }
  }

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("threshold.empty")}</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-3 rounded-md border p-3">
          <span className="text-sm font-medium">{t("threshold.tierLabel", { tier: field.tier })}</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`threshold-${index}-label`} className="text-xs">
                {t("threshold.fieldLabel")}
              </Label>
              <Input id={`threshold-${index}-label`} {...register(`thresholds.${index}.label`)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`threshold-${index}-color`} className="text-xs">
                {t("threshold.fieldColor")}
              </Label>
              <Input
                id={`threshold-${index}-color`}
                type="color"
                className="h-9 p-1"
                {...register(`thresholds.${index}.color`)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`threshold-${index}-minScore`} className="text-xs">
                {t("threshold.fieldMinScore")}
              </Label>
              <Input
                id={`threshold-${index}-minScore`}
                type="number"
                step="0.01"
                {...register(`thresholds.${index}.minScore`)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`threshold-${index}-maxScore`} className="text-xs">
                {t("threshold.fieldMaxScore")}
              </Label>
              <Input
                id={`threshold-${index}-maxScore`}
                type="number"
                step="0.01"
                {...register(`thresholds.${index}.maxScore`)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`threshold-${index}-months`} className="text-xs">
                {t("threshold.fieldBaseReassessmentMonths")}
              </Label>
              <Input
                id={`threshold-${index}-months`}
                type="number"
                {...register(`thresholds.${index}.baseReassessmentMonths`)}
              />
            </div>
          </div>
        </div>
      ))}

      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

function ConfigDetailContent() {
  const t = useTranslations("AdminVendorTierConfig");
  const params = useParams<{ id: string }>();
  const api = useApi();

  const [config, setConfig] = React.useState<VendorTierConfig | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [activating, setActivating] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<VendorTierConfig>(`/vendors/admin/tier-configs/${params.id}`)
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
      await api.post(`/vendors/admin/tier-configs/${config.id}/activate`);
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
      <Link
        href="/admin/vendor-tier-config"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {config.name}
              <span className="text-sm font-normal text-muted-foreground">v{config.version}</span>
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
            <ThresholdsForm config={config} onSaved={load} />
          </CardContent>
        </Card>
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

export default function AdminVendorTierConfigDetailPage() {
  return (
    <AdminSectionGate permission="vendors:manage">
      <ConfigDetailContent />
    </AdminSectionGate>
  );
}
