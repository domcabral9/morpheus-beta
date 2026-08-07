export interface UserDashboard {
  assessmentsByStatus: Record<string, number>;
  recentAssessments: Array<{
    id: string;
    softwareName: string;
    status: string;
    updatedAt: string;
  }>;
}

export interface AdminDashboard {
  assessmentsByStatus: Record<string, number>;
  pendingByStep: Array<{ stepName: string; count: number }>;
  slaBreaches: number;
  blockedAreasCount: number;
}

export interface ExecutiveDashboard {
  totalDecided: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  classificationDistribution: Record<string, number>;
}

export interface AreaLeaderboardEntry {
  areaId: string;
  areaName: string;
  volume: number;
  qualityScore: number;
  approvalRate: number;
  compositeScore: number;
  level: string;
}

export interface ComplianceControlResult {
  controlId: string;
  code: string;
  title: string;
  metCount: number;
  totalCount: number;
  /** Percentual de sujeitos que atendem o controle, ou `null` se nunca avaliado. */
  metPercentage: number | null;
}

export interface ComplianceFrameworkResult {
  frameworkCode: string;
  frameworkName: string;
  controls: ComplianceControlResult[];
  evaluatedControlsCount: number;
  totalControlsCount: number;
}
