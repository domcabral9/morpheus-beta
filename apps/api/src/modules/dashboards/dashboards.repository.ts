import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DashboardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countAssessmentsByStatus(tenantId: string) {
    return this.prisma.assessment.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    });
  }

  countMyAssessmentsByStatus(tenantId: string, requesterId: string) {
    return this.prisma.assessment.groupBy({
      by: ["status"],
      where: { tenantId, requesterId },
      _count: true,
    });
  }

  findRecentForUser(tenantId: string, requesterId: string, take = 5) {
    return this.prisma.assessment.findMany({
      where: { tenantId, requesterId },
      orderBy: { updatedAt: "desc" },
      take,
      select: { id: true, softwareName: true, status: true, updatedAt: true },
    });
  }

  /** Etapas de workflow abertas agora, agrupadas por etapa (para saber onde a fila está empacando). */
  countPendingStepsByStep(tenantId: string) {
    return this.prisma.workflowStepExecution.groupBy({
      by: ["workflowStepId"],
      where: {
        status: "IN_PROGRESS",
        assessmentWorkflowInstance: { assessment: { tenantId } },
      },
      _count: true,
    });
  }

  findStepsByIds(ids: string[]) {
    return this.prisma.workflowStep.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  countSlaBreaches(tenantId: string): Promise<number> {
    return this.prisma.workflowStepExecution.count({
      where: {
        status: "IN_PROGRESS",
        slaDueAt: { lt: new Date() },
        assessmentWorkflowInstance: { assessment: { tenantId } },
      },
    });
  }

  /**
   * Um TechnicalOpinion só é emitido em decisão terminal (Etapa 7), e
   * REJECTED/APPROVED não voltam a ser editáveis hoje (sem reabertura ainda
   * implementada) — então cada Assessment decidido tem no máximo um
   * TechnicalOpinion, o que torna esta consulta segura como base para
   * taxa de aprovação/qualidade/distribuição de classificação sem precisar
   * resolver "qual é a versão mais recente" manualmente.
   */
  findTerminalOpinions(tenantId: string) {
    return this.prisma.technicalOpinion.findMany({
      where: { tenantId },
      select: {
        classificationLabel: true,
        assessmentVersion: {
          select: {
            riskResult: { select: { totalScore: true } },
            assessment: { select: { areaId: true, status: true } },
          },
        },
      },
    });
  }

  findAllActiveAreas(tenantId: string) {
    return this.prisma.area.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true },
    });
  }

  countSubmittedByArea(tenantId: string) {
    return this.prisma.assessment.groupBy({
      by: ["areaId"],
      where: { tenantId, status: { not: "DRAFT" } },
      _count: true,
    });
  }

  /** Mesmo sinal derivado usado por `AssessmentsService.isAreaBlocked` (Fase 4 da renovação
   * anual) - áreas com pelo menos um item `EXPIRED` estão bloqueadas pra novas submissões. */
  async countBlockedAreas(tenantId: string): Promise<number> {
    const rows = await this.prisma.softwareInventoryItem.findMany({
      where: { tenantId, status: "EXPIRED" },
      select: { areaId: true },
      distinct: ["areaId"],
    });
    return rows.length;
  }
}
