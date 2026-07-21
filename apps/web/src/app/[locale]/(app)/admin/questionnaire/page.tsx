"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { QuestionAdmin, QuestionCategoryAdmin } from "@/lib/questionnaire-admin-types";
import { AdminSectionGate } from "../_components/section-gate";
import { CategoryFormDialog } from "./_components/category-form-dialog";
import { QuestionCreateDialog } from "./_components/question-create-dialog";

function CategorySection({
  category,
  questions,
  onEdit,
  onQuestionCreated,
}: {
  category: QuestionCategoryAdmin;
  questions: QuestionAdmin[];
  onEdit: () => void;
  onQuestionCreated: (question: QuestionAdmin) => void;
}) {
  const t = useTranslations("AdminQuestionnaire");
  const [open, setOpen] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex items-start gap-2 text-left"
          >
            {open ? (
              <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{category.name}</span>
                {!category.isActive && <Badge variant="outline">{t("category.inactive")}</Badge>}
              </div>
              {category.description && (
                <span className="text-sm text-muted-foreground">{category.description}</span>
              )}
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              {t("editButton")}
            </Button>
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("question.newButton")}
            </Button>
          </div>
        </div>

        {open && (
          <div className="flex flex-col gap-1 border-t pt-3">
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("question.empty")}</p>
            )}
            {questions.map((question) => (
              <Link
                key={question.id}
                href={`/admin/questionnaire/questions/${question.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <span className={question.isActive ? "" : "text-muted-foreground line-through"}>
                  {question.text}
                </span>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{t(`question.types.${question.type}`)}</Badge>
                  {question.controls.length > 0 && (
                    <Badge variant="outline">{t("question.controlsCount", { count: question.controls.length })}</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>

      <QuestionCreateDialog
        categoryId={category.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(question) => {
          setCreateOpen(false);
          onQuestionCreated(question);
        }}
      />
    </Card>
  );
}

function QuestionnaireAdminContent() {
  const t = useTranslations("AdminQuestionnaire");
  const api = useApi();

  const [categories, setCategories] = React.useState<QuestionCategoryAdmin[] | null>(null);
  const [questions, setQuestions] = React.useState<QuestionAdmin[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [createCategoryOpen, setCreateCategoryOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<QuestionCategoryAdmin | null>(null);

  const load = React.useCallback(() => {
    Promise.all([
      api.get<QuestionCategoryAdmin[]>("/questionnaire/admin/categories"),
      api.get<QuestionAdmin[]>("/questionnaire/admin/questions"),
    ])
      .then(([cats, qs]) => {
        setCategories(cats);
        setQuestions(qs);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setCreateCategoryOpen(true)}>
          <Plus />
          {t("category.newButton")}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && (!categories || !questions) && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {categories && categories.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("category.empty")}</p>
      )}

      {categories && questions && (
        <div className="flex flex-col gap-4">
          {categories.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              questions={questions.filter((question) => question.categoryId === category.id)}
              onEdit={() => setEditingCategory(category)}
              onQuestionCreated={() => load()}
            />
          ))}
        </div>
      )}

      <CategoryFormDialog
        mode="create"
        open={createCategoryOpen}
        onOpenChange={setCreateCategoryOpen}
        onSaved={() => {
          setCreateCategoryOpen(false);
          load();
        }}
      />

      {editingCategory && (
        <CategoryFormDialog
          mode="edit"
          category={editingCategory}
          open={!!editingCategory}
          onOpenChange={(open) => {
            if (!open) setEditingCategory(null);
          }}
          onSaved={() => {
            setEditingCategory(null);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function AdminQuestionnairePage() {
  return (
    <AdminSectionGate permission="questions:manage">
      <QuestionnaireAdminContent />
    </AdminSectionGate>
  );
}
