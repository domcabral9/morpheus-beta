import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { DashboardsRepository } from "./dashboards.repository";

const DECIDED_STATUSES = new Set(["APPROVED", "REJECTED"]);

/**
 * Pesos do placar de maturidade por área (gamificação). Mantidos como
 * constantes nomeadas em vez de mais uma entidade configurável no admin —
 * ao contrário da matriz de risco (Etapa 5) ou do workflow (Etapa 6), isso é
 * um recurso de engajamento, não uma regra de negócio/compliance, então não
 * justifica o custo de outro CRUD administrativo. Qualidade pesa mais que
 * volume de propósito: o objetivo é premiar áreas que submetem software já
 * bem avaliado tecnicamente, não só quem submete mais.
 */
const VOLUME_WEIGHT = 0.3;
const QUALITY_WEIGHT = 0.4;
const APPROVAL_WEIGHT = 0.3;

const LEVEL_THRESHOLDS = [
  { minScore: 4.5, label: "Referência" },
  { minScore: 3.5, label: "Avançado" },
  { minScore: 2.5, label: "Intermediário" },
  { minScore: 0, label: "Iniciante" },
] as const;

export interface AreaLeaderboardEntry {
  areaId: string;
  areaName: string;
  volume: number;
  qualityScore: number;
  approvalRate: number;
  compositeScore: number;
  level: string;
}

@Injectable()
export class DashboardsService {
  constructor(private readonly repository: DashboardsRepository) {}

  async getUserDashboard(user: AuthenticatedUser) {
    const [byStatus, recentAssessments] = await Promise.all([
      this.repository.countMyAssessmentsByStatus(user.tenantId, user.id),
      this.repository.findRecentForUser(user.tenantId, user.id),
    ]);

    return {
      assessmentsByStatus: this.toStatusMap(byStatus),
      recentAssessments,
    };
  }

  async getAdminDashboard(tenantId: string) {
    const [byStatus, pendingBySteps, slaBreaches, blockedAreasCount] = await Promise.all([
      this.repository.countAssessmentsByStatus(tenantId),
      this.repository.countPendingStepsByStep(tenantId),
      this.repository.countSlaBreaches(tenantId),
      this.repository.countBlockedAreas(tenantId),
    ]);

    const stepIds = pendingBySteps.map((row) => row.workflowStepId);
    const steps = stepIds.length > 0 ? await this.repository.findStepsByIds(stepIds) : [];
    const stepNameById = new Map(steps.map((step) => [step.id, step.name]));

    return {
      assessmentsByStatus: this.toStatusMap(byStatus),
      pendingByStep: pendingBySteps.map((row) => ({
        stepName: stepNameById.get(row.workflowStepId) ?? row.workflowStepId,
        count: row._count,
      })),
      slaBreaches,
      blockedAreasCount,
    };
  }

  async getExecutiveDashboard(tenantId: string) {
    const opinions = await this.repository.findTerminalOpinions(tenantId);

    let approved = 0;
    let rejected = 0;
    const classificationCounts = new Map<string, number>();

    for (const opinion of opinions) {
      const status = opinion.assessmentVersion.assessment.status;
      if (status === "APPROVED") approved += 1;
      if (status === "REJECTED") rejected += 1;
      classificationCounts.set(
        opinion.classificationLabel,
        (classificationCounts.get(opinion.classificationLabel) ?? 0) + 1,
      );
    }

    const decided = approved + rejected;

    return {
      totalDecided: decided,
      approved,
      rejected,
      approvalRate: decided > 0 ? this.round2(approved / decided) : 0,
      classificationDistribution: Object.fromEntries(classificationCounts),
    };
  }

  /** Placar de maturidade/adesão por área (gamificação) — combina volume, qualidade e taxa de aprovação. */
  async getAreaLeaderboard(tenantId: string): Promise<AreaLeaderboardEntry[]> {
    const [areas, submittedByArea, opinions] = await Promise.all([
      this.repository.findAllActiveAreas(tenantId),
      this.repository.countSubmittedByArea(tenantId),
      this.repository.findTerminalOpinions(tenantId),
    ]);

    const volumeByAreaId = new Map(submittedByArea.map((row) => [row.areaId, row._count]));
    const maxVolume = Math.max(1, ...areas.map((area) => volumeByAreaId.get(area.id) ?? 0));

    const statsByAreaId = new Map<
      string,
      { scores: number[]; approved: number; decided: number }
    >();
    for (const area of areas) {
      statsByAreaId.set(area.id, { scores: [], approved: 0, decided: 0 });
    }

    for (const opinion of opinions) {
      const { areaId, status } = opinion.assessmentVersion.assessment;
      const stat = statsByAreaId.get(areaId);
      if (!stat) continue; // área inativa/removida — não entra no placar

      const totalScore = opinion.assessmentVersion.riskResult?.totalScore;
      if (totalScore !== null && totalScore !== undefined) {
        stat.scores.push(Number(totalScore));
      }
      if (DECIDED_STATUSES.has(status)) {
        stat.decided += 1;
        if (status === "APPROVED") stat.approved += 1;
      }
    }

    const leaderboard = areas.map((area) => {
      const stat = statsByAreaId.get(area.id)!;
      const volume = volumeByAreaId.get(area.id) ?? 0;
      const qualityScore =
        stat.scores.length > 0
          ? stat.scores.reduce((sum, s) => sum + s, 0) / stat.scores.length
          : 0;
      const approvalRate = stat.decided > 0 ? stat.approved / stat.decided : 0;

      const volumeScore = (volume / maxVolume) * 5;
      const approvalScore = approvalRate * 5;
      const compositeScore =
        volumeScore * VOLUME_WEIGHT +
        qualityScore * QUALITY_WEIGHT +
        approvalScore * APPROVAL_WEIGHT;

      return {
        areaId: area.id,
        areaName: area.name,
        volume,
        qualityScore: this.round2(qualityScore),
        approvalRate: this.round2(approvalRate),
        compositeScore: this.round2(compositeScore),
        level: this.resolveLevel(compositeScore),
      };
    });

    return leaderboard.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  // --- Helpers ------------------------------------------------------------------
  private resolveLevel(score: number): string {
    const match = LEVEL_THRESHOLDS.find((level) => score >= level.minScore);
    return match?.label ?? "Iniciante";
  }

  private toStatusMap(rows: Array<{ status: string; _count: number }>): Record<string, number> {
    return Object.fromEntries(rows.map((row) => [row.status, row._count]));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
