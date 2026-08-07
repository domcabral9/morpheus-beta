"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export interface QuestionnaireAnswer {
  textValue?: string;
  scaleValue?: number;
  selectedOptionIds?: string[];
}

export interface QuestionnaireOption {
  id: string;
  label: string;
}

export interface QuestionnaireQuestion {
  id: string;
  text: string;
  description: string | null;
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "SCALE" | "TEXT";
  isRequired: boolean;
  options: QuestionnaireOption[];
}

export interface QuestionnaireCategory {
  id: string;
  name: string;
  questions: QuestionnaireQuestion[];
}

function isAnswered(question: QuestionnaireQuestion, answer: QuestionnaireAnswer | undefined): boolean {
  if (!answer) return false;
  switch (question.type) {
    case "TEXT":
      return Boolean(answer.textValue?.trim());
    case "SCALE":
      return answer.scaleValue !== undefined && !Number.isNaN(answer.scaleValue);
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return Boolean(answer.selectedOptionIds && answer.selectedOptionIds.length > 0);
  }
}

/**
 * Formulário de questionário categorizado, compartilhado entre a avaliação de
 * software (`/assessments/:id`) e a avaliação de fornecedor
 * (`/vendors/:id/assessments/:assessmentId`) - os dois tinham a mesma pilha
 * vertical de cards por categoria, uma cópia estrutural quase idêntica.
 * Uma aba por categoria em vez do padrão grid+colapsado já usado nas telas de
 * configuração (profile/platform-policy/risk-matrix/questionários admin):
 * aqui é preenchimento ativo, não navegação de config - colapsar esconderia
 * perguntas obrigatórias ainda não respondidas.
 */
export function QuestionnaireForm({
  categories,
  answers,
  onAnswer,
  isEditable,
  requiredMarkLabel,
  textPlaceholder,
}: {
  categories: QuestionnaireCategory[];
  answers: Record<string, QuestionnaireAnswer>;
  onAnswer: (questionId: string, value: QuestionnaireAnswer) => void;
  isEditable: boolean;
  requiredMarkLabel: string;
  textPlaceholder: string;
}) {
  const visibleCategories = categories.filter((category) => category.questions.length > 0);
  const [activeTab, setActiveTab] = React.useState(visibleCategories[0]?.id);

  if (visibleCategories.length === 0) return null;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        {visibleCategories.map((category) => {
          const answeredCount = category.questions.filter((question) =>
            isAnswered(question, answers[question.id]),
          ).length;
          const complete = answeredCount === category.questions.length;
          return (
            <TabsTrigger key={category.id} value={category.id} className="gap-2">
              {category.name}
              <Badge variant={complete ? "success" : "secondary"}>
                {answeredCount}/{category.questions.length}
              </Badge>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {visibleCategories.map((category) => (
        <TabsContent key={category.id} value={category.id} className="flex flex-col gap-6 pt-4">
          {category.questions.map((question) => (
            <div key={question.id} className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                {question.text}
                {question.isRequired && (
                  <span className="ml-1 text-destructive" aria-label={requiredMarkLabel}>
                    *
                  </span>
                )}
              </label>
              {question.description && (
                <p className="text-xs text-muted-foreground">{question.description}</p>
              )}

              {question.type === "TEXT" && (
                <Textarea
                  disabled={!isEditable}
                  placeholder={textPlaceholder}
                  value={answers[question.id]?.textValue ?? ""}
                  onChange={(event) => onAnswer(question.id, { textValue: event.target.value })}
                />
              )}

              {question.type === "SCALE" && (
                <input
                  type="number"
                  disabled={!isEditable}
                  className="h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  value={answers[question.id]?.scaleValue ?? ""}
                  onChange={(event) => onAnswer(question.id, { scaleValue: Number(event.target.value) })}
                />
              )}

              {question.type === "SINGLE_CHOICE" && (
                <div className="flex flex-col gap-1.5">
                  {question.options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={question.id}
                        disabled={!isEditable}
                        className="accent-primary"
                        checked={answers[question.id]?.selectedOptionIds?.[0] === option.id}
                        onChange={() => onAnswer(question.id, { selectedOptionIds: [option.id] })}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}

              {question.type === "MULTI_CHOICE" && (
                <div className="flex flex-col gap-1.5">
                  {question.options.map((option) => {
                    const selected = answers[question.id]?.selectedOptionIds ?? [];
                    const checked = selected.includes(option.id);
                    return (
                      <label key={option.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={!isEditable}
                          className="accent-primary"
                          checked={checked}
                          onChange={() =>
                            onAnswer(question.id, {
                              selectedOptionIds: checked
                                ? selected.filter((id) => id !== option.id)
                                : [...selected, option.id],
                            })
                          }
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
