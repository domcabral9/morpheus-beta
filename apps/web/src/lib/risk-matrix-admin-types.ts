export interface RiskLevel {
  id: string;
  riskMatrixConfigId: string;
  label: string;
  order: number;
  minScore: string;
  maxScore: string;
}

export interface RiskClassificationAdmin {
  id: string;
  riskMatrixConfigId: string;
  label: string;
  order: number;
  color: string;
  recommendationText: string | null;
  minScore: string;
  maxScore: string;
}

export interface RiskMatrixCellAdmin {
  id: string;
  riskMatrixConfigId: string;
  probabilityLevelId: string;
  impactLevelId: string;
  riskClassificationId: string;
}

export interface RiskMatrixConfigDetail {
  id: string;
  tenantId: string;
  name: string;
  version: number;
  isActive: boolean;
  minApprovalScore: string;
  createdAt: string;
  updatedAt: string;
  probabilityLevels: RiskLevel[];
  impactLevels: RiskLevel[];
  riskClassifications: RiskClassificationAdmin[];
  matrixCells: RiskMatrixCellAdmin[];
}

export interface RiskMatrixConfigSummary {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  minApprovalScore: string;
}
