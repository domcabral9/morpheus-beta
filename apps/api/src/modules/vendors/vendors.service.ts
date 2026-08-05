import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { RiskEngineService, ScorableAnswer } from "../risk-engine/risk-engine.service";
import { AuditLogService } from "../audit/audit-log.service";
import { withHasAvatar } from "../../common/utils/avatar.util";
import { VendorAssessmentDetail, VendorsRepository } from "./vendors.repository";
import { tierForScore } from "./vendor-tier.util";
import { computeNextReviewDate } from "./vendor-reassessment.util";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { CreateVendorAssessmentDto } from "./dto/create-vendor-assessment.dto";
import { CreateVendorQuestionCategoryDto } from "./dto/create-vendor-question-category.dto";
import { UpdateVendorQuestionCategoryDto } from "./dto/update-vendor-question-category.dto";
import { CreateVendorQuestionDto } from "./dto/create-vendor-question.dto";
import { UpdateVendorQuestionDto } from "./dto/update-vendor-question.dto";
import { VendorQuestionOptionDto } from "./dto/vendor-question-option.dto";
import { UpdateVendorQuestionOptionDto } from "./dto/update-vendor-question-option.dto";
import { CreateVendorTierConfigDto } from "./dto/create-vendor-tier-config.dto";
import { UpsertVendorTierThresholdDto } from "./dto/upsert-vendor-tier-threshold.dto";

/** Janela de "reavaliação próxima" na tela de Acompanhamento. */
const TRACKING_DUE_SOON_DAYS = 30;

/**
 * Sem workflow de aprovação (decisão #2 do plano de avaliação de
 * fornecedores) - `completeAssessment` calcula score/tier e fecha a
 * avaliação na mesma chamada, reaproveitando o `RiskEngineService` já usado
 * pelo motor de risco de software (função pura, sem acoplamento a
 * Assessment).
 */
@Injectable()
export class VendorsService {
  constructor(
    private readonly repository: VendorsRepository,
    private readonly riskEngineService: RiskEngineService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --- Vendor -------------------------------------------------------------------

  async listVendors(
    user: AuthenticatedUser,
    params: { search?: string; page?: number; pageSize?: number },
  ) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const { items, total } = await this.repository.findMany(user.tenantId, {
      search: params.search,
      page,
      pageSize,
    });
    return { items, total, page, pageSize };
  }

  async getVendor(user: AuthenticatedUser, id: string) {
    const vendor = await this.repository.findById(user.tenantId, id);
    if (!vendor) throw new NotFoundException("Fornecedor não encontrado.");
    return vendor;
  }

  /** Tela "Acompanhamento" de fornecedores - 3 baldes, sem filtro de
   * idempotência (diferente de `findDueForReassessment`, que é do scheduler). */
  getTracking(user: AuthenticatedUser) {
    return this.repository.findForTracking(user.tenantId, new Date(), TRACKING_DUE_SOON_DAYS);
  }

  createVendor(user: AuthenticatedUser, dto: CreateVendorDto) {
    return this.repository.create({
      tenantId: user.tenantId,
      name: dto.name,
      legalName: dto.legalName,
      taxId: dto.taxId,
      contactName: dto.contactName,
      contactEmail: dto.contactEmail,
      contractReference: dto.contractReference,
      notes: dto.notes,
      businessCriticality: dto.businessCriticality,
      createdById: user.id,
    });
  }

  async updateVendor(user: AuthenticatedUser, id: string, dto: UpdateVendorDto) {
    await this.getVendor(user, id);
    return this.repository.update(id, dto);
  }

  /** Usado pelo AssessmentsService pra resolver/validar um vendorId escolhido no picker. */
  findByIdForTenant(tenantId: string, id: string) {
    return this.repository.findById(tenantId, id);
  }

  async getVendorHistory(user: AuthenticatedUser, vendorId: string) {
    await this.getVendor(user, vendorId);
    const history = await this.repository.findAssessmentHistory(user.tenantId, vendorId);
    return history.map((entry) => ({ ...entry, performedBy: withHasAvatar(entry.performedBy) }));
  }

  // --- Catálogo de perguntas (admin) --------------------------------------------

  getActiveQuestionnaire(user: AuthenticatedUser) {
    return this.repository.findActiveCategories(user.tenantId);
  }

  listCategories(user: AuthenticatedUser) {
    return this.repository.listCategories(user.tenantId);
  }

  createCategory(user: AuthenticatedUser, dto: CreateVendorQuestionCategoryDto) {
    return this.repository.createCategory({
      tenantId: user.tenantId,
      name: dto.name,
      description: dto.description,
      order: dto.order ?? 0,
    });
  }

  async updateCategory(user: AuthenticatedUser, id: string, dto: UpdateVendorQuestionCategoryDto) {
    await this.assertCategoryInTenant(user.tenantId, id);
    return this.repository.updateCategory(id, dto);
  }

  listQuestions(user: AuthenticatedUser) {
    return this.repository.listQuestions(user.tenantId);
  }

  async createQuestion(user: AuthenticatedUser, dto: CreateVendorQuestionDto) {
    await this.assertCategoryInTenant(user.tenantId, dto.categoryId);
    const question = await this.repository.createQuestion({
      tenantId: user.tenantId,
      categoryId: dto.categoryId,
      text: dto.text,
      description: dto.description,
      weight: dto.weight,
      type: dto.type,
      order: dto.order ?? 0,
      isRequired: dto.isRequired ?? true,
    });
    if (dto.options?.length) {
      for (const [index, option] of dto.options.entries()) {
        await this.repository.addOption({
          questionId: question.id,
          label: option.label,
          value: option.value,
          score: option.score,
          order: option.order ?? index,
        });
      }
    }
    return this.repository.findQuestionById(user.tenantId, question.id);
  }

  async updateQuestion(user: AuthenticatedUser, id: string, dto: UpdateVendorQuestionDto) {
    const question = await this.repository.findQuestionById(user.tenantId, id);
    if (!question) throw new NotFoundException("Pergunta não encontrada.");
    if (dto.categoryId) await this.assertCategoryInTenant(user.tenantId, dto.categoryId);
    return this.repository.updateQuestion(id, dto);
  }

  async addOption(user: AuthenticatedUser, questionId: string, dto: VendorQuestionOptionDto) {
    const question = await this.repository.findQuestionById(user.tenantId, questionId);
    if (!question) throw new NotFoundException("Pergunta não encontrada.");
    return this.repository.addOption({
      questionId,
      label: dto.label,
      value: dto.value,
      score: dto.score,
      order: dto.order ?? question.options.length,
    });
  }

  async updateOption(user: AuthenticatedUser, id: string, dto: UpdateVendorQuestionOptionDto) {
    await this.assertOptionInTenant(user.tenantId, id);
    return this.repository.updateOption(id, dto);
  }

  async removeOption(user: AuthenticatedUser, id: string) {
    await this.assertOptionInTenant(user.tenantId, id);
    return this.repository.removeOption(id);
  }

  // --- Tierização (admin) --------------------------------------------------------

  listTierConfigs(user: AuthenticatedUser) {
    return this.repository.listTierConfigs(user.tenantId);
  }

  async getActiveTierConfig(user: AuthenticatedUser) {
    const config = await this.repository.findActiveTierConfig(user.tenantId);
    if (!config) {
      throw new NotFoundException("Nenhuma configuração de tier ativa para este tenant.");
    }
    return config;
  }

  createTierConfig(user: AuthenticatedUser, dto: CreateVendorTierConfigDto) {
    return this.repository.createTierConfig({
      tenantId: user.tenantId,
      name: dto.name,
      isActive: false,
    });
  }

  async activateTierConfig(user: AuthenticatedUser, id: string) {
    const config = await this.repository.findTierConfigById(user.tenantId, id);
    if (!config) throw new NotFoundException("Configuração de tier não encontrada.");
    return this.repository.activateTierConfig(user.tenantId, id);
  }

  async upsertThreshold(
    user: AuthenticatedUser,
    configId: string,
    dto: UpsertVendorTierThresholdDto,
  ) {
    const config = await this.repository.findTierConfigById(user.tenantId, configId);
    if (!config) throw new NotFoundException("Configuração de tier não encontrada.");
    const { tier, ...rest } = dto;
    return this.repository.upsertThreshold(configId, tier, rest);
  }

  // --- Avaliação de fornecedor -----------------------------------------------------

  async createDraftAssessment(
    user: AuthenticatedUser,
    vendorId: string,
    dto: CreateVendorAssessmentDto,
  ) {
    await this.getVendor(user, vendorId);
    const tierConfig = dto.vendorTierConfigId
      ? await this.repository.findTierConfigById(user.tenantId, dto.vendorTierConfigId)
      : await this.repository.findActiveTierConfig(user.tenantId);
    if (!tierConfig) {
      throw new UnprocessableEntityException(
        "Nenhuma configuração de tier disponível para este tenant.",
      );
    }

    const assessment = await this.repository.createAssessment({
      tenantId: user.tenantId,
      vendorId,
      performedById: user.id,
      vendorTierConfigId: tierConfig.id,
      status: "DRAFT",
      notes: dto.notes,
    });

    if (dto.answers?.length) {
      await this.repository.replaceAnswers(assessment.id, dto.answers);
    }
    return this.repository.findAssessmentById(user.tenantId, assessment.id);
  }

  async updateDraftAssessment(
    user: AuthenticatedUser,
    vendorId: string,
    assessmentId: string,
    dto: CreateVendorAssessmentDto,
  ) {
    const assessment = await this.assertDraftInTenant(user.tenantId, vendorId, assessmentId);

    if (dto.notes !== undefined || dto.vendorTierConfigId) {
      await this.repository.updateAssessment(assessment.id, {
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.vendorTierConfigId ? { vendorTierConfigId: dto.vendorTierConfigId } : {}),
      });
    }
    if (dto.answers) {
      await this.repository.replaceAnswers(assessment.id, dto.answers);
    }
    return this.repository.findAssessmentById(user.tenantId, assessmentId);
  }

  /**
   * Núcleo da feature: fecha o rascunho, calcula o score reutilizando o
   * `RiskEngineService` existente (mesma convenção 0-5 do questionário de
   * software: score de entrada é risco cru, `computeScores` inverte pra
   * score final onde maior = mais favorável), classifica contra os
   * thresholds do tier config vinculado e denormaliza o resultado no
   * `Vendor` (pra lista/futuro dashboard não recalcular a cada leitura).
   */
  async completeAssessment(user: AuthenticatedUser, vendorId: string, assessmentId: string) {
    const assessment = await this.assertDraftInTenant(user.tenantId, vendorId, assessmentId);

    const tierConfig = await this.repository.findTierConfigById(
      user.tenantId,
      assessment.vendorTierConfigId,
    );
    if (!tierConfig || tierConfig.thresholds.length === 0) {
      throw new UnprocessableEntityException(
        "A configuração de tier vinculada não tem faixas configuradas.",
      );
    }

    const scorableAnswers = this.buildScorableAnswers(assessment.answers);
    const { totalScore } = this.riskEngineService.computeScores(scorableAnswers);
    const result = tierForScore(
      tierConfig.thresholds.map((t) => ({
        tier: t.tier,
        label: t.label,
        minScore: Number(t.minScore),
        maxScore: Number(t.maxScore),
      })),
      totalScore,
    );
    if (!result) {
      throw new UnprocessableEntityException(
        "Não foi possível classificar o score contra os thresholds configurados.",
      );
    }

    const threshold = tierConfig.thresholds.find((t) => t.tier === result.tier)!;
    const now = new Date();
    const nextReviewDueAt = computeNextReviewDate(
      threshold.baseReassessmentMonths,
      assessment.vendor.businessCriticality,
      now,
    );

    const updated = await this.repository.updateAssessment(assessment.id, {
      status: "COMPLETED",
      totalScore,
      tier: result.tier,
      tierLabel: result.label,
      completedAt: now,
      nextReviewDueAt,
    });

    await this.repository.update(vendorId, {
      currentTier: result.tier,
      currentTierLabel: result.label,
      currentScore: totalScore,
      lastAssessedAt: now,
      nextReviewDueAt,
      reassessmentNotifiedAt: null,
    });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "CREATE",
      entityType: "VendorAssessment",
      entityId: assessment.id,
      metadata: { vendorId, tier: result.tier, tierLabel: result.label, totalScore },
    });

    return updated;
  }

  /** Usado pela tela de retomar rascunho/ver histórico - sem restrição de status (DRAFT ou COMPLETED). */
  async getAssessment(user: AuthenticatedUser, vendorId: string, assessmentId: string) {
    const assessment = await this.repository.findAssessmentById(user.tenantId, assessmentId);
    if (!assessment || assessment.vendorId !== vendorId) {
      throw new NotFoundException("Avaliação de fornecedor não encontrada.");
    }
    return { ...assessment, performedBy: withHasAvatar(assessment.performedBy) };
  }

  // --- Auxiliares privados -----------------------------------------------------------

  private async assertDraftInTenant(
    tenantId: string,
    vendorId: string,
    assessmentId: string,
  ): Promise<VendorAssessmentDetail> {
    const assessment = await this.repository.findAssessmentById(tenantId, assessmentId);
    if (!assessment || assessment.vendorId !== vendorId) {
      throw new NotFoundException("Avaliação de fornecedor não encontrada.");
    }
    if (assessment.status !== "DRAFT") {
      throw new UnprocessableEntityException("Esta avaliação já foi concluída.");
    }
    return assessment;
  }

  private async assertCategoryInTenant(tenantId: string, id: string) {
    const category = await this.repository.findCategoryById(tenantId, id);
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    return category;
  }

  private async assertOptionInTenant(tenantId: string, optionId: string) {
    const questions = await this.repository.listQuestions(tenantId);
    const found = questions.some((question) =>
      question.options.some((option) => option.id === optionId),
    );
    if (!found) throw new NotFoundException("Opção não encontrada.");
  }

  /** Mesma lógica de `AssessmentsService.resolveScorableAnswers`, adaptada pro catálogo de fornecedor (sem riskDimension - fixo em "BOTH", ver decisão de escopo). */
  private buildScorableAnswers(answers: VendorAssessmentDetail["answers"]): ScorableAnswer[] {
    const scorable: ScorableAnswer[] = [];

    for (const answer of answers) {
      const question = answer.vendorQuestion;
      if (question.type === "TEXT") continue;

      let score: number | null = null;
      if (question.type === "SCALE") {
        score = answer.scaleValue ?? null;
      } else if (answer.selectedOptions.length > 0) {
        const sum = answer.selectedOptions.reduce(
          (acc, selected) => acc + Number(selected.vendorQuestionOption.score),
          0,
        );
        score = sum / answer.selectedOptions.length;
      }

      if (score === null) continue;

      scorable.push({ riskDimension: "BOTH", weight: Number(question.weight), score });
    }

    return scorable;
  }
}
