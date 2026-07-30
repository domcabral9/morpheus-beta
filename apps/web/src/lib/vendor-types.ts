import type { Criticality, QuestionType } from "@/lib/assessment-types";

export type VendorAssessmentStatus = "DRAFT" | "COMPLETED";

export interface VendorSummary {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contractReference: string | null;
  notes: string | null;
  businessCriticality: Criticality | null;
  isActive: boolean;
  /** Snapshot da VendorAssessment COMPLETED mais recente - null até a primeira avaliação. */
  currentTier: number | null;
  currentTierLabel: string | null;
  currentScore: string | null;
  lastAssessedAt: string | null;
  nextReviewDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VendorDetail = VendorSummary;

export interface VendorListItem extends VendorSummary {
  _count: { assessments: number };
}

export interface PaginatedVendors {
  items: VendorListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Resposta de `GET /vendors/tracking` - 3 baldes pra aba "Acompanhamento". */
export interface VendorTracking {
  neverAssessed: VendorListItem[];
  overdue: VendorListItem[];
  dueSoon: VendorListItem[];
}

export interface VendorFormValues {
  name: string;
  legalName?: string;
  taxId?: string;
  contactName?: string;
  contactEmail?: string;
  contractReference?: string;
  notes?: string;
  businessCriticality?: Criticality;
  isActive?: boolean;
}

export interface VendorQuestionOption {
  id: string;
  label: string;
  value: string;
  score: string;
  order: number;
}

export interface VendorQuestion {
  id: string;
  categoryId: string;
  text: string;
  description: string | null;
  weight: string;
  type: QuestionType;
  order: number;
  isActive: boolean;
  isRequired: boolean;
  options: VendorQuestionOption[];
}

export interface VendorQuestionCategory {
  id: string;
  name: string;
  description: string | null;
  order: number;
  questions: VendorQuestion[];
}

export interface VendorAnswer {
  id: string;
  vendorQuestionId: string;
  textValue: string | null;
  scaleValue: number | null;
  selectedOptions: Array<{ vendorQuestionOption: { id: string } }>;
}

export interface VendorAssessmentSummary {
  id: string;
  vendorId: string;
  performedById: string;
  vendorTierConfigId: string;
  status: VendorAssessmentStatus;
  totalScore: string | null;
  tier: number | null;
  tierLabel: string | null;
  notes: string | null;
  completedAt: string | null;
  nextReviewDueAt: string | null;
  createdAt: string;
  performedBy: { id: string; name: string; email: string };
}

export interface VendorAssessmentDetail extends VendorAssessmentSummary {
  vendor: VendorSummary;
  answers: VendorAnswer[];
}
