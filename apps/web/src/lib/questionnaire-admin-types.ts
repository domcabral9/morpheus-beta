export const QUESTION_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "SCALE", "TEXT"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const RISK_DIMENSIONS = ["PROBABILITY", "IMPACT", "BOTH"] as const;
export type RiskDimension = (typeof RISK_DIMENSIONS)[number];

export const CHOICE_TYPES = new Set<QuestionType>(["SINGLE_CHOICE", "MULTI_CHOICE"]);

export interface QuestionCategoryAdmin {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
}

export interface QuestionOptionAdmin {
  id: string;
  label: string;
  value: string;
  score: string;
  order: number;
}

export interface ControlFrameworkSummary {
  id: string;
  code: string;
  name: string;
}

export interface ControlSummary {
  id: string;
  frameworkId: string;
  code: string;
  title: string;
  description: string | null;
  framework: ControlFrameworkSummary;
}

export interface QuestionControlLink {
  questionId: string;
  controlId: string;
  control: ControlSummary;
}

export interface QuestionAdmin {
  id: string;
  categoryId: string;
  text: string;
  description: string | null;
  weight: string;
  type: QuestionType;
  riskDimension: RiskDimension;
  order: number;
  isActive: boolean;
  isRequired: boolean;
  options: QuestionOptionAdmin[];
  controls: QuestionControlLink[];
}
