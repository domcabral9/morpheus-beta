import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { RiskMatrixRepository, RiskMatrixConfigDetail } from "./risk-matrix.repository";
import { CreateRiskMatrixConfigDto } from "./dto/create-config.dto";
import { UpdateRiskMatrixConfigDto } from "./dto/update-config.dto";
import { CreateLevelDto } from "./dto/create-level.dto";
import { UpdateLevelDto } from "./dto/update-level.dto";
import { CreateClassificationDto } from "./dto/create-classification.dto";
import { UpdateClassificationDto } from "./dto/update-classification.dto";
import { UpsertCellDto } from "./dto/upsert-cell.dto";

/**
 * CRUD administrativo da matriz de risco (Etapa 5). Mantido como módulo
 * separado do `risk-engine` (que fica só com o cálculo/leitura em tempo de
 * submissão) — administração e execução têm ciclos de mudança e permissões
 * diferentes (`risk-matrix:manage` vs. uso interno pelo motor).
 */
@Injectable()
export class RiskMatrixService {
  constructor(private readonly riskMatrixRepository: RiskMatrixRepository) {}

  // --- Config -----------------------------------------------------------------
  listConfigs(tenantId: string): Promise<RiskMatrixConfigDetail[]> {
    return this.riskMatrixRepository.findAllForTenant(tenantId);
  }

  async getConfig(tenantId: string, id: string): Promise<RiskMatrixConfigDetail> {
    return this.assertConfigInTenant(tenantId, id);
  }

  async createConfig(
    tenantId: string,
    dto: CreateRiskMatrixConfigDto,
  ): Promise<RiskMatrixConfigDetail> {
    const existing = await this.riskMatrixRepository.findAllForTenant(tenantId);
    const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map((c) => c.version)) + 1;

    const config = await this.riskMatrixRepository.createConfig({
      tenantId,
      name: dto.name,
      version: nextVersion,
      minApprovalScore: dto.minApprovalScore,
      // Nasce inativa por padrão — o admin ativa explicitamente quando a
      // matriz estiver totalmente configurada (faixas + classificações),
      // evitando que o motor de risco use uma matriz incompleta.
      isActive: false,
    });

    if (dto.activate) {
      return this.riskMatrixRepository.activate(tenantId, config.id);
    }
    return config;
  }

  async updateConfig(
    tenantId: string,
    id: string,
    dto: UpdateRiskMatrixConfigDto,
  ): Promise<RiskMatrixConfigDetail> {
    await this.assertConfigInTenant(tenantId, id);
    return this.riskMatrixRepository.updateConfig(id, dto);
  }

  async activateConfig(tenantId: string, id: string): Promise<RiskMatrixConfigDetail> {
    const config = await this.assertConfigInTenant(tenantId, id);
    if (
      config.probabilityLevels.length === 0 ||
      config.impactLevels.length === 0 ||
      config.riskClassifications.length === 0
    ) {
      throw new BadRequestException(
        "A matriz precisa de ao menos uma faixa de probabilidade, uma de impacto e uma classificação antes de ser ativada.",
      );
    }
    return this.riskMatrixRepository.activate(tenantId, id);
  }

  // --- Faixas de probabilidade --------------------------------------------------
  async addProbabilityLevel(tenantId: string, configId: string, dto: CreateLevelDto) {
    this.assertScoreRange(dto.minScore, dto.maxScore);
    await this.assertConfigInTenant(tenantId, configId);
    return this.riskMatrixRepository.createProbabilityLevel({
      riskMatrixConfigId: configId,
      label: dto.label,
      order: dto.order ?? 0,
      minScore: dto.minScore,
      maxScore: dto.maxScore,
    });
  }

  async updateProbabilityLevel(tenantId: string, id: string, dto: UpdateLevelDto) {
    const level = await this.assertProbabilityLevelInTenant(tenantId, id);
    this.assertScoreRange(
      dto.minScore ?? Number(level.minScore),
      dto.maxScore ?? Number(level.maxScore),
    );
    return this.riskMatrixRepository.updateProbabilityLevel(id, dto);
  }

  async removeProbabilityLevel(tenantId: string, id: string): Promise<void> {
    await this.assertProbabilityLevelInTenant(tenantId, id);
    const usageCount = await this.riskMatrixRepository.countRiskResultsUsingProbabilityLevel(id);
    if (usageCount > 0) {
      throw new BadRequestException(
        "Esta faixa já foi usada em resultados de risco calculados e não pode ser removida.",
      );
    }
    await this.riskMatrixRepository.deleteProbabilityLevel(id);
  }

  // --- Faixas de impacto ---------------------------------------------------------
  async addImpactLevel(tenantId: string, configId: string, dto: CreateLevelDto) {
    this.assertScoreRange(dto.minScore, dto.maxScore);
    await this.assertConfigInTenant(tenantId, configId);
    return this.riskMatrixRepository.createImpactLevel({
      riskMatrixConfigId: configId,
      label: dto.label,
      order: dto.order ?? 0,
      minScore: dto.minScore,
      maxScore: dto.maxScore,
    });
  }

  async updateImpactLevel(tenantId: string, id: string, dto: UpdateLevelDto) {
    const level = await this.assertImpactLevelInTenant(tenantId, id);
    this.assertScoreRange(
      dto.minScore ?? Number(level.minScore),
      dto.maxScore ?? Number(level.maxScore),
    );
    return this.riskMatrixRepository.updateImpactLevel(id, dto);
  }

  async removeImpactLevel(tenantId: string, id: string): Promise<void> {
    await this.assertImpactLevelInTenant(tenantId, id);
    const usageCount = await this.riskMatrixRepository.countRiskResultsUsingImpactLevel(id);
    if (usageCount > 0) {
      throw new BadRequestException(
        "Esta faixa já foi usada em resultados de risco calculados e não pode ser removida.",
      );
    }
    await this.riskMatrixRepository.deleteImpactLevel(id);
  }

  // --- Classificações --------------------------------------------------------------
  async addClassification(tenantId: string, configId: string, dto: CreateClassificationDto) {
    this.assertScoreRange(dto.minScore, dto.maxScore);
    await this.assertConfigInTenant(tenantId, configId);
    return this.riskMatrixRepository.createClassification({
      riskMatrixConfigId: configId,
      label: dto.label,
      order: dto.order ?? 0,
      color: dto.color,
      recommendationText: dto.recommendationText,
      minScore: dto.minScore,
      maxScore: dto.maxScore,
    });
  }

  async updateClassification(tenantId: string, id: string, dto: UpdateClassificationDto) {
    const classification = await this.assertClassificationInTenant(tenantId, id);
    this.assertScoreRange(
      dto.minScore ?? Number(classification.minScore),
      dto.maxScore ?? Number(classification.maxScore),
    );
    return this.riskMatrixRepository.updateClassification(id, dto);
  }

  async removeClassification(tenantId: string, id: string): Promise<void> {
    await this.assertClassificationInTenant(tenantId, id);
    const usageCount = await this.riskMatrixRepository.countRiskResultsUsingClassification(id);
    if (usageCount > 0) {
      throw new BadRequestException(
        "Esta classificação já foi usada em resultados de risco calculados e não pode ser removida.",
      );
    }
    await this.riskMatrixRepository.deleteClassification(id);
  }

  // --- Células da matriz (heatmap, reservado para Etapa 9) ------------------------
  async upsertCell(tenantId: string, configId: string, dto: UpsertCellDto) {
    await this.assertConfigInTenant(tenantId, configId);
    await this.assertProbabilityLevelInTenant(tenantId, dto.probabilityLevelId, configId);
    await this.assertImpactLevelInTenant(tenantId, dto.impactLevelId, configId);
    await this.assertClassificationInTenant(tenantId, dto.riskClassificationId, configId);

    return this.riskMatrixRepository.upsertCell({
      riskMatrixConfigId: configId,
      probabilityLevelId: dto.probabilityLevelId,
      impactLevelId: dto.impactLevelId,
      riskClassificationId: dto.riskClassificationId,
    });
  }

  async removeCell(tenantId: string, id: string): Promise<void> {
    const cell = await this.riskMatrixRepository.findCellById(id);
    if (!cell) throw new NotFoundException("Célula não encontrada.");
    if (cell.riskMatrixConfig.tenantId !== tenantId) {
      throw new ForbiddenException("Célula de outro tenant.");
    }
    await this.riskMatrixRepository.deleteCell(id);
  }

  // --- Helpers de tenant scoping / integridade -------------------------------------
  private async assertConfigInTenant(
    tenantId: string,
    id: string,
  ): Promise<RiskMatrixConfigDetail> {
    const config = await this.riskMatrixRepository.findById(id);
    if (!config) throw new NotFoundException("Matriz de risco não encontrada.");
    if (config.tenantId !== tenantId) throw new ForbiddenException("Matriz de outro tenant.");
    return config;
  }

  private async assertProbabilityLevelInTenant(tenantId: string, id: string, configId?: string) {
    const level = await this.riskMatrixRepository.findProbabilityLevelById(id);
    if (!level) throw new NotFoundException("Faixa de probabilidade não encontrada.");
    if (level.riskMatrixConfig.tenantId !== tenantId) {
      throw new ForbiddenException("Faixa de outro tenant.");
    }
    if (configId && level.riskMatrixConfigId !== configId) {
      throw new BadRequestException("Faixa de probabilidade não pertence a esta matriz.");
    }
    return level;
  }

  private async assertImpactLevelInTenant(tenantId: string, id: string, configId?: string) {
    const level = await this.riskMatrixRepository.findImpactLevelById(id);
    if (!level) throw new NotFoundException("Faixa de impacto não encontrada.");
    if (level.riskMatrixConfig.tenantId !== tenantId) {
      throw new ForbiddenException("Faixa de outro tenant.");
    }
    if (configId && level.riskMatrixConfigId !== configId) {
      throw new BadRequestException("Faixa de impacto não pertence a esta matriz.");
    }
    return level;
  }

  private async assertClassificationInTenant(tenantId: string, id: string, configId?: string) {
    const classification = await this.riskMatrixRepository.findClassificationById(id);
    if (!classification) throw new NotFoundException("Classificação não encontrada.");
    if (classification.riskMatrixConfig.tenantId !== tenantId) {
      throw new ForbiddenException("Classificação de outro tenant.");
    }
    if (configId && classification.riskMatrixConfigId !== configId) {
      throw new BadRequestException("Classificação não pertence a esta matriz.");
    }
    return classification;
  }

  private assertScoreRange(minScore: number, maxScore: number): void {
    if (minScore > maxScore) {
      throw new BadRequestException("minScore não pode ser maior que maxScore.");
    }
  }
}
