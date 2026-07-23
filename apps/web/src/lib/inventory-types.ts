import type { Criticality } from "@/lib/assessment-types";

export const SOFTWARE_TYPES = ["SAAS", "ON_PREMISES", "DESKTOP", "MOBILE", "API_INTEGRATION"] as const;
export type SoftwareType = (typeof SOFTWARE_TYPES)[number];

export const DATA_CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export const INVENTORY_STATUSES = ["ACTIVE", "PENDING_REVIEW", "EXPIRED", "DECOMMISSIONED"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const INVENTORY_ORIGINS = ["HOMOLOGATED", "MANUAL"] as const;
export type InventoryOrigin = (typeof INVENTORY_ORIGINS)[number];

export interface InventoryTechnicalOpinionSummary {
  id: string;
  number: string;
  classificationLabel: string;
  issuedAt: string;
}

export interface InventoryDocumentationLink {
  id: string;
  label: string;
  url: string;
}

export interface InventoryItemSummary {
  id: string;
  name: string;
  vendor: string;
  category: string;
  type: SoftwareType;
  status: InventoryStatus;
  criticality: Criticality;
  nextReviewDate: string;
  area: { id: string; name: string };
  manager: { id: string; name: string; email: string };
  technicalResponsible: { id: string; name: string; email: string };
  /** Parecer da homologação que originou este item - `null` pra itens de entrada manual. */
  technicalOpinion: InventoryTechnicalOpinionSummary | null;
  assessmentId: string | null;
  hasRiskAnalysis: boolean;
  hasInfoSecClause: boolean;
}

export interface InventoryItemDetail extends InventoryItemSummary {
  version: string | null;
  url: string | null;
  hostingProvider: string | null;
  homologationDate: string;
  dataClassification: DataClassification;
  documentationLinks: InventoryDocumentationLink[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedInventory {
  items: InventoryItemSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InventoryItemFormValues {
  name: string;
  vendor: string;
  version?: string;
  url?: string;
  category: string;
  type: SoftwareType;
  hostingProvider?: string;
  areaId: string;
  managerId: string;
  technicalResponsibleId: string;
  homologationDate: string;
  nextReviewDate: string;
  criticality: Criticality;
  dataClassification: DataClassification;
  status?: InventoryStatus;
  hasRiskAnalysis: boolean;
  hasInfoSecClause: boolean;
  documentationLinks: { label: string; url: string }[];
}

export interface InventoryListFilters {
  status: string;
  areaId: string;
  type: string;
  criticality: string;
  origin: string;
  hasRiskAnalysis: string;
  hasInfoSecClause: string;
}

export interface InventoryStats {
  totalItems: number;
  byStatus: { status: InventoryStatus; _count: number }[];
  byCriticality: { criticality: Criticality; _count: number }[];
  byType: { type: SoftwareType; _count: number }[];
  byArea: { areaId: string; _count: number }[];
  byHostingProvider: { hostingProvider: string | null; _count: number }[];
  homologatedCount: number;
  manualCount: number;
  riskAnalysisYes: number;
  riskAnalysisNo: number;
  infoSecClauseYes: number;
  infoSecClauseNo: number;
  overdueReviews: number;
  dueSoonReviews: number;
}
