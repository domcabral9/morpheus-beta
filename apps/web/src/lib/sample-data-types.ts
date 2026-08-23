export const SAMPLE_ENTITY_TYPES = ["vendor", "inventory-item", "assessment"] as const;
export type SampleEntityType = (typeof SAMPLE_ENTITY_TYPES)[number];

export interface SampleDataItem {
  entityType: SampleEntityType;
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PaginatedSampleData {
  items: SampleDataItem[];
  total: number;
  page: number;
  pageSize: number;
}
