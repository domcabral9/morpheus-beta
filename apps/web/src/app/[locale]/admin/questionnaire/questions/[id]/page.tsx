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
import { usePermission } from "@/lib/use-permission";
import { ApiError } from "@/components/auth-provider";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  CHOICE_TYPES,
  QUESTION_TYPES,
  RISK_DIMENSIONS,
  type QuestionAdmin,
  type QuestionCategoryAdmin,
  type QuestionOptionAdmin,
} from "@/lib/questionnaire-admin-types";
import { AdminSectionGate } from "../../../_components/section-gate";
import { OptionFormDialog } from "../_components/option-form-dialog";
import { ControlLinkDialog } from "../_components/control-link-dialog";

const basicSchema = z.object({
  categoryId: z.string().min(1),
  text: z.string().min(1),
  description: z.string().optional(),
  weight: z.coerce.number().min(0),
  type: z.enum(QUESTION_TYPES),
  riskDimension: z.enum(RISK_DIMENSIONS),
  order: z.coerce.number().int().optional(),
  isRequired: z.boolean(),
  isActive: z.boolean(),
});

type BasicFormInput = z.input<typeof basicSchema>;
type BasicFormOutput = z.output<typeof basicSchema>;

function BasicInfoForm({
  question,
  categories,
  onSaved,
}: {
  question: QuestionAdmin;
  categories: QuestionCategoryAdmin[];
  onSaved: (question: QuestionAdmin) => void;
}) {
  const t = useTranslations("AdminQuestionnaire");
  const api = useApi();

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<BasicFormInput, unknown, BasicFormOutput>({
    resolver: zodResolver(basicSchema),
    defaultValues: {
      categoryId: question.categoryId,
      text: question.text,
      description: question.description ?? "",
      weight: Number(question.weight),
      type: question.type,
      riskDimension: question.riskDimension,
      order: question.order,
      isRequired: question.isRequired,
      isActive: question.isActive,
    },
  });

  async function onSubmit(values: BasicFormOutput) {
    try {
      const updated = await api.patch<QuestionAdmin>(`/questionnaire/admin/questions/${question.id}`, {
        ...values,
        description: values.description || undefined,
      });
      toast.success(t("question.updateSuccess"));
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("question.saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="q-category">{t("question.fieldCategory")}</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="q-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="q-text">{t("question.fieldText")}</Label>
        <Textarea id="q-text" rows={2} {...register("text")} aria-invalid={!!errors.text} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="q-description">{t("question.fieldDescription")}</Label>
        <Textarea id="q-description" rows={2} {...register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="q-weight">{t("question.fieldWeight")}</Label>
          <Input id="q-weight" type="number" step="0.01" {...register("weight")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="q-order">{t("question.fieldOrder")}</Label>
          <Input id="q-order" type="number" {...register("order")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="q-type">{t("question.fieldType")}</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="q-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`question.types.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="q-riskDimension">{t("question.fieldRiskDimension")}</Label>
          <Controller
            control={control}
            name="riskDimension"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="q-riskDimension">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_DIMENSIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`question.riskDimensions.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isRequired"
            render={({ field }) => (
              <input
                id="q-required"
                type="checkbox"
                className="size-4"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
          <Label htmlFor="q-required" className="font-normal">
            {t("question.fieldIsRequired")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <input
                id="q-active"
                type="checkbox"
                className="size-4"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
          <Label htmlFor="q-active" className="font-normal">
            {t("question.fieldIsActive")}
          </Label>
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

function OptionsSection({
  question,
  onChanged,
}: {
  question: QuestionAdmin;
  onChanged: (question: QuestionAdmin) => void;
}) {
  const t = useTranslations("AdminQuestionnaire");
  const api = useApi();

  const [dialogState, setDialogState] = React.useState<
    { mode: "create" } | { mode: "edit"; option: QuestionOptionAdmin } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = React.useState<QuestionOptionAdmin | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/questionnaire/admin/options/${deleteTarget.id}`);
      toast.success(t("question.optionDeleteSuccess"));
      onChanged({
        ...question,
        options: question.options.filter((option) => option.id !== deleteTarget.id),
      });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("question.optionDeleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("question.optionsTitle")}</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setDialogState({ mode: "create" })}>
          <Plus />
          {t("question.addOption")}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {question.options.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("question.noOptions")}</p>
        )}
        {question.options.map((option) => (
          <div
            key={option.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {t("question.optionValue")}: {option.value} · {t("question.optionScore")}: {option.score}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDialogState({ mode: "edit", option })}
              >
                <Pencil className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(option)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      {dialogState?.mode === "create" && (
        <OptionFormDialog
          mode="create"
          questionId={question.id}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          onSaved={(option) => {
            setDialogState(null);
            onChanged({ ...question, options: [...question.options, option] });
          }}
        />
      )}
      {dialogState?.mode === "edit" && (
        <OptionFormDialog
          mode="edit"
          option={dialogState.option}
          questionId={question.id}
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          onSaved={(option) => {
            setDialogState(null);
            onChanged({
              ...question,
              options: question.options.map((current) => (current.id === option.id ? option : current)),
            });
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("question.optionDeleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("question.optionDeleteConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? t("saving") : t("question.optionDeleteConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ControlsSection({
  question,
  onChanged,
}: {
  question: QuestionAdmin;
  onChanged: (question: QuestionAdmin) => void;
}) {
  const t = useTranslations("AdminQuestionnaire");
  const api = useApi();
  const canManageControls = usePermission("controls:manage");

  const [linkOpen, setLinkOpen] = React.useState(false);
  const [unlinkTarget, setUnlinkTarget] = React.useState<string | null>(null);
  const [unlinking, setUnlinking] = React.useState(false);

  async function handleUnlink() {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      await api.delete(`/questionnaire/admin/questions/${question.id}/controls/${unlinkTarget}`);
      toast.success(t("question.controlUnlinkSuccess"));
      onChanged({
        ...question,
        controls: question.controls.filter((link) => link.controlId !== unlinkTarget),
      });
      setUnlinkTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("question.controlUnlinkError"));
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("question.controlsTitle")}</CardTitle>
        {canManageControls && (
          <Button type="button" size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
            <Plus />
            {t("question.linkControlButton")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {question.controls.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("question.noControls")}</p>
        )}
        {question.controls.map((link) => (
          <div
            key={link.controlId}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">
                [{link.control.framework.code}] {link.control.code}
              </span>
              <span className="text-xs text-muted-foreground">{link.control.title}</span>
            </div>
            {canManageControls && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setUnlinkTarget(link.controlId)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>

      {linkOpen && (
        <ControlLinkDialog
          question={question}
          open={linkOpen}
          onOpenChange={setLinkOpen}
          onLinked={(updated) => {
            setLinkOpen(false);
            onChanged(updated);
          }}
        />
      )}

      <AlertDialog open={!!unlinkTarget} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("question.controlUnlinkConfirmTitle")}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={unlinking} onClick={handleUnlink}>
              {unlinking ? t("saving") : t("question.controlUnlinkConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function QuestionDetailContent() {
  const t = useTranslations("AdminQuestionnaire");
  const params = useParams<{ id: string }>();
  const api = useApi();

  const [question, setQuestion] = React.useState<QuestionAdmin | null | undefined>(undefined);
  const [categories, setCategories] = React.useState<QuestionCategoryAdmin[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      api.get<QuestionAdmin[]>("/questionnaire/admin/questions"),
      api.get<QuestionCategoryAdmin[]>("/questionnaire/admin/categories"),
    ])
      .then(([questions, cats]) => {
        setQuestion(questions.find((q) => q.id === params.id) ?? null);
        setCategories(cats);
        setError(null);
      })
      .catch(() => setError(t("question.detailLoadError")));
  }, [api, params.id, t]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        href="/admin/questionnaire"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {t("back")}
      </Link>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && question === undefined && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {question === null && <p className="text-sm text-muted-foreground">{t("question.notFound")}</p>}

      {question && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("question.detailTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <BasicInfoForm question={question} categories={categories} onSaved={setQuestion} />
            </CardContent>
          </Card>

          {CHOICE_TYPES.has(question.type) && (
            <OptionsSection question={question} onChanged={setQuestion} />
          )}

          <ControlsSection question={question} onChanged={setQuestion} />
        </>
      )}
    </div>
  );
}

export default function AdminQuestionDetailPage() {
  return (
    <AdminSectionGate permission="questions:manage">
      <QuestionDetailContent />
    </AdminSectionGate>
  );
}
