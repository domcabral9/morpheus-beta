import { Injectable } from "@nestjs/common";
import { Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const vendorListInclude = {
  _count: { select: { assessments: true } },
} satisfies Prisma.VendorInclude;

export type VendorListItem = Prisma.VendorGetPayload<{ include: typeof vendorListInclude }>;

const activeTierConfigInclude = {
  thresholds: { orderBy: { tier: "asc" } },
} satisfies Prisma.VendorTierConfigInclude;

export type ActiveVendorTierConfig = Prisma.VendorTierConfigGetPayload<{
  include: typeof activeTierConfigInclude;
}>;

const vendorQuestionInclude = {
  options: { orderBy: { order: "asc" } },
} satisfies Prisma.VendorQuestionInclude;

export type VendorQuestionWithOptions = Prisma.VendorQuestionGetPayload<{
  include: typeof vendorQuestionInclude;
}>;

const vendorAssessmentDetailInclude = {
  vendor: true,
  performedBy: { select: { id: true, name: true, email: true, avatarPath: true } },
  answers: {
    include: {
      vendorQuestion: true,
      selectedOptions: { include: { vendorQuestionOption: true } },
    },
  },
} satisfies Prisma.VendorAssessmentInclude;

export type VendorAssessmentDetail = Prisma.VendorAssessmentGetPayload<{
  include: typeof vendorAssessmentDetailInclude;
}>;

const dueForReassessmentInclude = {
  assessments: {
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 1,
    include: { performedBy: { select: { id: true, isActive: true } } },
  },
} satisfies Prisma.VendorInclude;

export type VendorDueForReassessment = Prisma.VendorGetPayload<{
  include: typeof dueForReassessmentInclude;
}>;

@Injectable()
export class VendorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Vendor -----------------------------------------------------------------

  async findMany(
    tenantId: string,
    params: { search?: string; page: number; pageSize: number },
  ): Promise<{ items: VendorListItem[]; total: number }> {
    const where: Prisma.VendorWhereInput = {
      tenantId,
      ...(params.search ? { name: { contains: params.search, mode: "insensitive" as const } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        include: vendorListInclude,
        orderBy: { name: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return { items, total };
  }

  findById(tenantId: string, id: string) {
    return this.prisma.vendor.findFirst({ where: { id, tenantId } });
  }

  /** Avaliações de Software deste fornecedor que já declararam SOC 2/ISO
   * 27001 (com anexo obrigatório validado em `AssessmentsService.submit()`)
   * - alimenta o painel de reaproveitamento na ART do fornecedor, pra não
   * pedir o mesmo documento de novo. Só metadado, o anexo em si continua
   * vivendo na Assessment de origem. */
  findComplianceEvidence(tenantId: string, vendorId: string) {
    return this.prisma.assessment.findMany({
      where: {
        tenantId,
        vendorId,
        OR: [{ hasSoc2Report: true }, { hasIso27001Certificate: true }],
      },
      select: { id: true, softwareName: true, hasSoc2Report: true, hasIso27001Certificate: true },
      orderBy: { softwareName: "asc" },
    });
  }

  /** Tela "Acompanhamento" - 3 baldes, sem o filtro `reassessmentNotifiedAt`
   * (esse é só pra idempotência do job de notificação, ver
   * `findDueForReassessment` abaixo). Sempre `isActive: true`. */
  async findForTracking(tenantId: string, now: Date, dueSoonDays: number) {
    const dueSoonThreshold = new Date(now);
    dueSoonThreshold.setDate(dueSoonThreshold.getDate() + dueSoonDays);

    const [neverAssessed, overdue, dueSoon] = await Promise.all([
      this.prisma.vendor.findMany({
        where: { tenantId, isActive: true, currentTier: null },
        include: vendorListInclude,
        orderBy: { name: "asc" },
      }),
      this.prisma.vendor.findMany({
        where: {
          tenantId,
          isActive: true,
          currentTier: { not: null },
          nextReviewDueAt: { lt: now },
        },
        include: vendorListInclude,
        orderBy: { nextReviewDueAt: "asc" },
      }),
      this.prisma.vendor.findMany({
        where: {
          tenantId,
          isActive: true,
          currentTier: { not: null },
          nextReviewDueAt: { gte: now, lte: dueSoonThreshold },
        },
        include: vendorListInclude,
        orderBy: { nextReviewDueAt: "asc" },
      }),
    ]);

    return { neverAssessed, overdue, dueSoon };
  }

  create(data: Prisma.VendorUncheckedCreateInput) {
    return this.prisma.vendor.create({ data });
  }

  update(id: string, data: Prisma.VendorUncheckedUpdateInput) {
    return this.prisma.vendor.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.vendor.delete({ where: { id } });
  }

  /** Quantas VendorAssessment (ART) - rascunho ou concluída - existem pra
   * esse fornecedor. Usado, junto de
   * `AssessmentsRepository.countOtherAssessmentsForVendor`, pra decidir se um
   * fornecedor é genuinamente órfão o suficiente pra ser excluído junto com
   * a Assessment que o criou (ver `AssessmentsService.resolveOrphanVendor`). */
  countAssessments(vendorId: string): Promise<number> {
    return this.prisma.vendorAssessment.count({ where: { vendorId } });
  }

  /** As 3 contagens que definem se um fornecedor é órfão o suficiente pra
   * ser excluído de verdade (achado 2026-08-20) - qualquer status em todas,
   * método próprio e independente de `countAssessments` (que continua só a
   * serviço de `resolveOrphanVendor`, com sua própria semântica). */
  async countLinkedRecords(vendorId: string): Promise<{
    inventoryCount: number;
    assessmentCount: number;
    vendorAssessmentCount: number;
  }> {
    const [inventoryCount, assessmentCount, vendorAssessmentCount] = await Promise.all([
      this.prisma.softwareInventoryItem.count({ where: { vendorId } }),
      this.prisma.assessment.count({ where: { vendorId } }),
      this.prisma.vendorAssessment.count({ where: { vendorId } }),
    ]);
    return { inventoryCount, assessmentCount, vendorAssessmentCount };
  }

  findAssessmentHistory(tenantId: string, vendorId: string) {
    return this.prisma.vendorAssessment.findMany({
      where: { tenantId, vendorId },
      include: { performedBy: { select: { id: true, name: true, email: true, avatarPath: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- Catálogo de perguntas ----------------------------------------------------

  findActiveCategories(tenantId: string) {
    return this.prisma.vendorQuestionCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: "asc" },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          include: vendorQuestionInclude,
        },
      },
    });
  }

  listCategories(tenantId: string) {
    return this.prisma.vendorQuestionCategory.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
    });
  }

  createCategory(data: Prisma.VendorQuestionCategoryUncheckedCreateInput) {
    return this.prisma.vendorQuestionCategory.create({ data });
  }

  updateCategory(id: string, data: Prisma.VendorQuestionCategoryUncheckedUpdateInput) {
    return this.prisma.vendorQuestionCategory.update({ where: { id }, data });
  }

  findCategoryById(tenantId: string, id: string) {
    return this.prisma.vendorQuestionCategory.findFirst({ where: { id, tenantId } });
  }

  listQuestions(tenantId: string): Promise<VendorQuestionWithOptions[]> {
    return this.prisma.vendorQuestion.findMany({
      where: { tenantId },
      include: vendorQuestionInclude,
      orderBy: { order: "asc" },
    });
  }

  findQuestionById(tenantId: string, id: string): Promise<VendorQuestionWithOptions | null> {
    return this.prisma.vendorQuestion.findFirst({
      where: { id, tenantId },
      include: vendorQuestionInclude,
    });
  }

  createQuestion(data: Prisma.VendorQuestionUncheckedCreateInput) {
    return this.prisma.vendorQuestion.create({ data });
  }

  updateQuestion(id: string, data: Prisma.VendorQuestionUncheckedUpdateInput) {
    return this.prisma.vendorQuestion.update({ where: { id }, data });
  }

  addOption(data: Prisma.VendorQuestionOptionUncheckedCreateInput) {
    return this.prisma.vendorQuestionOption.create({ data });
  }

  updateOption(id: string, data: Prisma.VendorQuestionOptionUncheckedUpdateInput) {
    return this.prisma.vendorQuestionOption.update({ where: { id }, data });
  }

  removeOption(id: string) {
    return this.prisma.vendorQuestionOption.delete({ where: { id } });
  }

  // --- Tierização ---------------------------------------------------------------

  findActiveTierConfig(tenantId: string): Promise<ActiveVendorTierConfig | null> {
    return this.prisma.vendorTierConfig.findFirst({
      where: { tenantId, isActive: true },
      include: activeTierConfigInclude,
    });
  }

  findTierConfigById(tenantId: string, id: string): Promise<ActiveVendorTierConfig | null> {
    return this.prisma.vendorTierConfig.findFirst({
      where: { id, tenantId },
      include: activeTierConfigInclude,
    });
  }

  listTierConfigs(tenantId: string) {
    return this.prisma.vendorTierConfig.findMany({
      where: { tenantId },
      include: activeTierConfigInclude,
      orderBy: { version: "desc" },
    });
  }

  createTierConfig(data: Prisma.VendorTierConfigUncheckedCreateInput) {
    return this.prisma.vendorTierConfig.create({ data });
  }

  async activateTierConfig(tenantId: string, id: string) {
    await this.prisma.vendorTierConfig.updateMany({
      where: { tenantId, isActive: true },
      data: { isActive: false },
    });
    return this.prisma.vendorTierConfig.update({ where: { id }, data: { isActive: true } });
  }

  upsertThreshold(
    vendorTierConfigId: string,
    tier: number,
    data: Omit<Prisma.VendorTierThresholdUncheckedCreateInput, "vendorTierConfigId" | "tier">,
  ) {
    return this.prisma.vendorTierThreshold.upsert({
      where: { vendorTierConfigId_tier: { vendorTierConfigId, tier } },
      update: data,
      create: { vendorTierConfigId, tier, ...data },
    });
  }

  // --- Avaliação de fornecedor ---------------------------------------------------

  findAssessmentById(tenantId: string, id: string): Promise<VendorAssessmentDetail | null> {
    return this.prisma.vendorAssessment.findFirst({
      where: { id, tenantId },
      include: vendorAssessmentDetailInclude,
    });
  }

  createAssessment(
    data: Prisma.VendorAssessmentUncheckedCreateInput,
  ): Promise<VendorAssessmentDetail> {
    return this.prisma.vendorAssessment.create({ data, include: vendorAssessmentDetailInclude });
  }

  updateAssessment(
    id: string,
    data: Prisma.VendorAssessmentUncheckedUpdateInput,
  ): Promise<VendorAssessmentDetail> {
    return this.prisma.vendorAssessment.update({
      where: { id },
      data,
      include: vendorAssessmentDetailInclude,
    });
  }

  /**
   * Substituição completa das respostas de um rascunho - mesmo padrão de
   * "full-replace" já usado no projeto pra coleções filhas pequenas (ex.:
   * permissões de um papel, links de documentação de um item de inventário)
   * em vez de diff por resposta.
   */
  async replaceAnswers(
    vendorAssessmentId: string,
    answers: Array<{
      vendorQuestionId: string;
      textValue?: string;
      scaleValue?: number;
      selectedOptionIds?: string[];
    }>,
  ) {
    await this.prisma.vendorAnswer.deleteMany({ where: { vendorAssessmentId } });
    for (const answer of answers) {
      const created = await this.prisma.vendorAnswer.create({
        data: {
          vendorAssessmentId,
          vendorQuestionId: answer.vendorQuestionId,
          textValue: answer.textValue,
          scaleValue: answer.scaleValue,
        },
      });
      if (answer.selectedOptionIds?.length) {
        await this.prisma.vendorAnswerOption.createMany({
          data: answer.selectedOptionIds.map((optionId) => ({
            vendorAnswerId: created.id,
            vendorQuestionOptionId: optionId,
          })),
        });
      }
    }
  }

  // --- Scheduler de reavaliação ---------------------------------------------------

  /**
   * Fornecedores ativos já avaliados ao menos uma vez (`currentTier` não
   * nulo) cuja próxima revisão já venceu e ainda não foram notificados -
   * `reassessmentNotifiedAt IS NULL` mantém o job idempotente (a trava é
   * limpa de novo em `VendorsService.completeAssessment` na próxima
   * avaliação concluída).
   */
  findDueForReassessment(now: Date): Promise<VendorDueForReassessment[]> {
    return this.prisma.vendor.findMany({
      where: {
        isActive: true,
        currentTier: { not: null },
        nextReviewDueAt: { lte: now },
        reassessmentNotifiedAt: null,
      },
      include: dueForReassessmentInclude,
    });
  }

  markReassessmentNotified(id: string, notifiedAt: Date) {
    return this.prisma.vendor.update({
      where: { id },
      data: { reassessmentNotifiedAt: notifiedAt },
    });
  }

  // Papéis seedados (Administrador, Usuário) são únicos por tenant
  // (`@@unique([tenantId, name])`) - mesmo proxy usado pelo RenewalRepository
  // pra "quem pode agir quando não há um responsável ativo específico".
  // Duplicado aqui (em vez de importar RenewalRepository) porque
  // VendorsModule é intencionalmente autocontido, mesmo espírito de
  // RenewalModule não depender de outros módulos de feature.
  findAdministradorRoleId(tenantId: string) {
    return this.prisma.role.findFirst({
      where: { tenantId, name: "Administrador" },
      select: { id: true },
    });
  }
}
