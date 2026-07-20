import { Injectable } from "@nestjs/common";
import { Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const configDetailInclude = {
  probabilityLevels: { orderBy: { order: "asc" } },
  impactLevels: { orderBy: { order: "asc" } },
  riskClassifications: { orderBy: { order: "asc" } },
  matrixCells: true,
} satisfies Prisma.RiskMatrixConfigInclude;

export type RiskMatrixConfigDetail = Prisma.RiskMatrixConfigGetPayload<{
  include: typeof configDetailInclude;
}>;

@Injectable()
export class RiskMatrixRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Config -----------------------------------------------------------------
  findAllForTenant(tenantId: string): Promise<RiskMatrixConfigDetail[]> {
    return this.prisma.riskMatrixConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: configDetailInclude,
    });
  }

  findById(id: string): Promise<RiskMatrixConfigDetail | null> {
    return this.prisma.riskMatrixConfig.findUnique({
      where: { id },
      include: configDetailInclude,
    });
  }

  createConfig(data: Prisma.RiskMatrixConfigUncheckedCreateInput): Promise<RiskMatrixConfigDetail> {
    return this.prisma.riskMatrixConfig.create({ data, include: configDetailInclude });
  }

  updateConfig(
    id: string,
    data: Prisma.RiskMatrixConfigUncheckedUpdateInput,
  ): Promise<RiskMatrixConfigDetail> {
    return this.prisma.riskMatrixConfig.update({
      where: { id },
      data,
      include: configDetailInclude,
    });
  }

  activate(tenantId: string, id: string): Promise<RiskMatrixConfigDetail> {
    return this.prisma.$transaction(async (tx) => {
      await tx.riskMatrixConfig.updateMany({
        where: { tenantId, id: { not: id } },
        data: { isActive: false },
      });
      return tx.riskMatrixConfig.update({
        where: { id },
        data: { isActive: true },
        include: configDetailInclude,
      });
    });
  }

  // --- Faixas de probabilidade --------------------------------------------------
  createProbabilityLevel(data: Prisma.ProbabilityLevelUncheckedCreateInput) {
    return this.prisma.probabilityLevel.create({ data });
  }

  findProbabilityLevelById(id: string) {
    return this.prisma.probabilityLevel.findUnique({
      where: { id },
      include: { riskMatrixConfig: true },
    });
  }

  updateProbabilityLevel(id: string, data: Prisma.ProbabilityLevelUncheckedUpdateInput) {
    return this.prisma.probabilityLevel.update({ where: { id }, data });
  }

  deleteProbabilityLevel(id: string) {
    return this.prisma.probabilityLevel.delete({ where: { id } });
  }

  countRiskResultsUsingProbabilityLevel(id: string): Promise<number> {
    return this.prisma.riskResult.count({ where: { probabilityLevelId: id } });
  }

  // --- Faixas de impacto ---------------------------------------------------------
  createImpactLevel(data: Prisma.ImpactLevelUncheckedCreateInput) {
    return this.prisma.impactLevel.create({ data });
  }

  findImpactLevelById(id: string) {
    return this.prisma.impactLevel.findUnique({
      where: { id },
      include: { riskMatrixConfig: true },
    });
  }

  updateImpactLevel(id: string, data: Prisma.ImpactLevelUncheckedUpdateInput) {
    return this.prisma.impactLevel.update({ where: { id }, data });
  }

  deleteImpactLevel(id: string) {
    return this.prisma.impactLevel.delete({ where: { id } });
  }

  countRiskResultsUsingImpactLevel(id: string): Promise<number> {
    return this.prisma.riskResult.count({ where: { impactLevelId: id } });
  }

  // --- Classificações --------------------------------------------------------------
  createClassification(data: Prisma.RiskClassificationUncheckedCreateInput) {
    return this.prisma.riskClassification.create({ data });
  }

  findClassificationById(id: string) {
    return this.prisma.riskClassification.findUnique({
      where: { id },
      include: { riskMatrixConfig: true },
    });
  }

  updateClassification(id: string, data: Prisma.RiskClassificationUncheckedUpdateInput) {
    return this.prisma.riskClassification.update({ where: { id }, data });
  }

  deleteClassification(id: string) {
    return this.prisma.riskClassification.delete({ where: { id } });
  }

  countRiskResultsUsingClassification(id: string): Promise<number> {
    return this.prisma.riskResult.count({ where: { riskClassificationId: id } });
  }

  // --- Células da matriz (heatmap, reservado para Etapa 9) ------------------------
  upsertCell(data: Prisma.RiskMatrixCellUncheckedCreateInput) {
    return this.prisma.riskMatrixCell.upsert({
      where: {
        probabilityLevelId_impactLevelId: {
          probabilityLevelId: data.probabilityLevelId,
          impactLevelId: data.impactLevelId,
        },
      },
      update: { riskClassificationId: data.riskClassificationId },
      create: data,
    });
  }

  findCellById(id: string) {
    return this.prisma.riskMatrixCell.findUnique({
      where: { id },
      include: { riskMatrixConfig: true },
    });
  }

  deleteCell(id: string) {
    return this.prisma.riskMatrixCell.delete({ where: { id } });
  }
}
