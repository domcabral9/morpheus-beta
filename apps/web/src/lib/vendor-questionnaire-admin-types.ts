export const VENDOR_QUESTION_TYPES = ["SINGLE_CHOICE", "MULTI_CHOICE", "SCALE", "TEXT"] as const;
export type VendorQuestionType = (typeof VENDOR_QUESTION_TYPES)[number];

export const VENDOR_CHOICE_TYPES = new Set<VendorQuestionType>(["SINGLE_CHOICE", "MULTI_CHOICE"]);

export interface VendorQuestionCategoryAdmin {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
}

export interface VendorQuestionOptionAdmin {
  id: string;
  label: string;
  value: string;
  score: string;
  order: number;
}

export interface VendorQuestionAdmin {
  id: string;
  categoryId: string;
  text: string;
  description: string | null;
  weight: string;
  type: VendorQuestionType;
  order: number;
  isActive: boolean;
  isRequired: boolean;
  options: VendorQuestionOptionAdmin[];
}
