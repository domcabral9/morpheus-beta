export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AssessmentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "PENDING_ADJUSTMENT"
  | "APPROVED"
  | "REJECTED"
  | "REOPENED"
  | "PENDING_RENEWAL";

export interface Area {
  id: string;
  name: string;
  isActive: boolean;
}

export type QuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "SCALE" | "TEXT";
export type RiskDimension = "PROBABILITY" | "IMPACT" | "BOTH";

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  score: string;
  order: number;
}

export interface Question {
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
  options: QuestionOption[];
}

export interface QuestionCategory {
  id: string;
  name: string;
  description: string | null;
  order: number;
  questions: Question[];
}

export interface AssessmentSummary {
  id: string;
  softwareName: string;
  vendor: string;
  version: string | null;
  criticality: Criticality;
  status: AssessmentStatus;
  createdAt: string;
  area: { id: string; name: string };
  requester: { id: string; name: string; email: string };
  responsible: { id: string; name: string; email: string };
}

export interface AssessmentDetail extends AssessmentSummary {
  url: string | null;
  justification: string;
  tenantId: string;
  areaId: string;
  requesterId: string;
  responsibleId: string;
  hasRiskAnalysis: boolean;
  hasInfoSecClause: boolean;
  versions: Array<{ id: string; versionLabel: string; createdAt: string }>;
}

export interface AssessmentAnswer {
  id: string;
  questionId: string;
  textValue: string | null;
  scaleValue: number | null;
  selectedOptions: Array<{ questionOptionId: string }>;
}

export interface PaginatedAssessments {
  items: AssessmentSummary[];
  total: number;
  page: number;
  pageSize: number;
}
