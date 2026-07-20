import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const activeConfigInclude = {
  probabilityLevels: { orderBy: { order: "asc" } },
  impactLevels: { orderBy: { order: "asc" } },
  riskClassifications: { orderBy: { order: "asc" } },
} satisfies Prisma.RiskMatrixConfigInclude;

export type ActiveRiskMatrixConfig = Prisma.RiskMatrixConfigGetPayload<{
  include: typeof activeConfigInclude;
}>;

@Injectable()
export class RiskEngineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveConfig(tenantId: string): Promise<ActiveRiskMatrixConfig> {
    const config = await this.prisma.riskMatrixConfig.findFirst({
      where: { tenantId, isActive: true },
      include: activeConfigInclude,
    });
    if (!config) {
      throw new NotFoundException("Nenhuma matriz de risco ativa configurada para este tenant.");
    }
    return config;
  }

  createRiskResult(data: Prisma.RiskResultUncheckedCreateInput) {
    return this.prisma.riskResult.create({ data });
  }
}
