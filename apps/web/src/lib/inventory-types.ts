import type { Criticality } from "@/lib/assessment-types";

export const SOFTWARE_TYPES = ["SAAS", "ON_PREMISES", "DESKTOP", "MOBILE", "API_INTEGRATION"] as const;
export type SoftwareType = (typeof SOFTWARE_TYPES)[number];

export const DATA_CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export const INVENTORY_STATUSES = ["ACTIVE", "PENDING_REVIEW", "EXPIRED", "DECOMMISSIONED"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export interface InventoryTechnicalOpinionSummary {
  id: string;
  number: string;
  classificationLabel: string;
  issuedAt: string;
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
}

export interface InventoryItemDetail extends InventoryItemSummary {
  assessmentId: string | null;
  version: string | null;
  url: string | null;
  hostingProvider: string | null;
  homologationDate: string;
  dataClassification: DataClassification;
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
}
