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

/** Espelha `isVendorComplete` do backend (`vendor-completeness.util.ts`) -
 * Nome + Razão Social + CNPJ + Criticidade, só presença. Obrigatório pro
 * fornecedor contar como "ativo e vivo" em `/vendors` e pra desbloquear a
 * decisão de aprovação no workflow, mas nunca bloqueia iniciar uma
 * homologação nova. */
export interface VendorCompletenessInput {
  name: string;
  legalName: string | null;
  taxId: string | null;
  businessCriticality: string | null;
}

export function isVendorComplete(vendor: VendorCompletenessInput): boolean {
  return (
    !!vendor.name?.trim() &&
    !!vendor.legalName?.trim() &&
    !!vendor.taxId?.trim() &&
    !!vendor.businessCriticality
  );
}

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
  performedBy: { id: string; name: string; email: string; hasAvatar: boolean };
}

export interface VendorAssessmentDetail extends VendorAssessmentSummary {
  vendor: VendorSummary;
  answers: VendorAnswer[];
}

/** Item de `GET /vendors/:id/compliance-evidence` - avaliação de Software
 * deste fornecedor que já declarou SOC 2/ISO 27001 (com anexo validado no
 * envio), pra não pedir o mesmo documento de novo numa ART. */
export interface VendorComplianceEvidence {
  id: string;
  softwareName: string;
  hasSoc2Report: boolean;
  hasIso27001Certificate: boolean;
}
