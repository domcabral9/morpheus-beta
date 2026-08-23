export interface VendorTierThreshold {
  id: string;
  vendorTierConfigId: string;
  tier: number;
  label: string;
  color: string;
  minScore: string;
  maxScore: string;
  baseReassessmentMonths: number;
}

export interface VendorTierConfig {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  thresholds: VendorTierThreshold[];
}

export interface VendorTierConfigSummary {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
}
