export const ATTACHMENT_CATEGORIES = [
  "CONTRACT",
  "DPA",
  "SOC2_REPORT",
  "ISO27001_CERTIFICATE",
  "PENTEST_REPORT",
  "ARCHITECTURE_DOCUMENT",
  "DPIA",
  "PRIVACY_POLICY",
  "OTHER",
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export const ATTACHMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024;

export const ATTACHMENT_ACCEPT =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,application/zip";

export interface AttachmentDetail {
  id: string;
  category: AttachmentCategory;
  fileName: string;
  version: number;
  uploadedAt: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
}

export type AttachmentParent = { assessmentId: string } | { inventoryItemId: string };
