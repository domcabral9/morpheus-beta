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
  performedBy: { select: { id: true, name: true, email: true } },
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
      ...(params.search
        ? { name: { contains: params.search, mode: "insensitive" as const } }
        : {}),
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

  create(data: Prisma.VendorUncheckedCreateInput) {
    return this.prisma.vendor.create({ data });
  }

  update(id: string, data: Prisma.VendorUncheckedUpdateInput) {
    return this.prisma.vendor.update({ where: { id }, data });
  }

  findAssessmentHistory(tenantId: string, vendorId: string) {
    return this.prisma.vendorAssessment.findMany({
      where: { tenantId, vendorId },
      include: { performedBy: { select: { id: true, name: true, email: true } } },
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
}
