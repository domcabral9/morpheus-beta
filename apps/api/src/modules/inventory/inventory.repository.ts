import { Injectable } from "@nestjs/common";
import { Prisma, InventoryStatus, SoftwareType, Criticality } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const itemDetailInclude = {
  area: true,
  manager: { select: { id: true, name: true, email: true } },
  technicalResponsible: { select: { id: true, name: true, email: true } },
  documentationLinks: {
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true, url: true },
  },
  // Parecer técnico da homologação que originou este item, quando existir -
  // itens de entrada manual (`assessmentId` nulo) nunca têm um. Pega só a
  // versão mais recente da avaliação (`take: 1`) - mesma noção de "o parecer
  // vigente" já usada em `TechnicalOpinionRepository.findLatestForAssessment`.
  assessment: {
    select: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          technicalOpinion: {
            select: { id: true, number: true, classificationLabel: true, issuedAt: true },
          },
        },
      },
    },
  },
} satisfies Prisma.SoftwareInventoryItemInclude;

export type InventoryItemDetail = Prisma.SoftwareInventoryItemGetPayload<{
  include: typeof itemDetailInclude;
}>;

export interface DocumentationLinkInput {
  label: string;
  url: string;
}

export interface InventoryFilterParams {
  tenantId: string;
  status?: InventoryStatus;
  areaId?: string;
  type?: SoftwareType;
  criticality?: Criticality;
  origin?: "HOMOLOGATED" | "MANUAL";
  hasRiskAnalysis?: boolean;
  hasInfoSecClause?: boolean;
}

function buildWhereClause(params: InventoryFilterParams): Prisma.SoftwareInventoryItemWhereInput {
  return {
    tenantId: params.tenantId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.areaId ? { areaId: params.areaId } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.criticality ? { criticality: params.criticality } : {}),
    ...(params.origin === "HOMOLOGATED" ? { assessmentId: { not: null } } : {}),
    ...(params.origin === "MANUAL" ? { assessmentId: null } : {}),
    ...(params.hasRiskAnalysis !== undefined ? { hasRiskAnalysis: params.hasRiskAnalysis } : {}),
    ...(params.hasInfoSecClause !== undefined ? { hasInfoSecClause: params.hasInfoSecClause } : {}),
  };
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: Prisma.SoftwareInventoryItemUncheckedCreateInput,
    documentationLinks?: DocumentationLinkInput[],
  ): Promise<InventoryItemDetail> {
    return this.prisma.softwareInventoryItem.create({
      data: {
        ...data,
        documentationLinks: documentationLinks?.length
          ? { create: documentationLinks.map((link) => ({ tenantId: data.tenantId, ...link })) }
          : undefined,
      },
      include: itemDetailInclude,
    });
  }

  /** Substitui a lista inteira de links do item (mesmo padrão de
   * `RolesRepository.setPermissions`) - não há edição pontual de um link, só
   * da lista completa a cada save do formulário. */
  async setDocumentationLinks(
    inventoryItemId: string,
    tenantId: string,
    links: DocumentationLinkInput[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.inventoryDocumentationLink.deleteMany({ where: { inventoryItemId } }),
      ...(links.length
        ? [
            this.prisma.inventoryDocumentationLink.createMany({
              data: links.map((link) => ({ inventoryItemId, tenantId, ...link })),
            }),
          ]
        : []),
    ]);
  }

  findById(id: string): Promise<InventoryItemDetail | null> {
    return this.prisma.softwareInventoryItem.findUnique({
      where: { id },
      include: itemDetailInclude,
    });
  }

  findByAssessmentId(assessmentId: string): Promise<InventoryItemDetail | null> {
    return this.prisma.softwareInventoryItem.findFirst({
      where: { assessmentId },
      include: itemDetailInclude,
    });
  }

  /** Duplicidade = mesmo nome (case-insensitive) na mesma área, homologado
   * ou manual - a regra não se aplica entre áreas diferentes, que podem ter
   * contratos/administração distintos para o mesmo software. */
  findDuplicateByNameAndArea(
    tenantId: string,
    areaId: string,
    name: string,
  ): Promise<{
    id: string;
    name: string;
    vendor: string;
    status: InventoryStatus;
    assessmentId: string | null;
  } | null> {
    return this.prisma.softwareInventoryItem.findFirst({
      where: { tenantId, areaId, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true, name: true, vendor: true, status: true, assessmentId: true },
    });
  }

  async findMany(
    params: InventoryFilterParams & { page: number; pageSize: number },
  ): Promise<{ items: InventoryItemDetail[]; total: number }> {
    const where = buildWhereClause(params);

    const [items, total] = await Promise.all([
      this.prisma.softwareInventoryItem.findMany({
        where,
        include: itemDetailInclude,
        orderBy: { nextReviewDate: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.softwareInventoryItem.count({ where }),
    ]);

    return { items, total };
  }

  /** Mesmos filtros de `findMany`, sem paginação - usado pelo export
   * (CSV/JSON), que precisa de todas as linhas que batem com o filtro. */
  findAllMatching(params: InventoryFilterParams): Promise<InventoryItemDetail[]> {
    return this.prisma.softwareInventoryItem.findMany({
      where: buildWhereClause(params),
      include: itemDetailInclude,
      orderBy: { name: "asc" },
    });
  }

  /** Agregados pro "Visão geral" do módulo de inventário - sem filtro (a
   * visão geral é sempre do tenant inteiro; filtros ficam só na listagem). */
  async getStats(tenantId: string, reviewDueSoonDays: number) {
    const now = new Date();
    const dueSoonThreshold = new Date(now);
    dueSoonThreshold.setDate(dueSoonThreshold.getDate() + reviewDueSoonDays);

    const [
      totalItems,
      byStatus,
      byCriticality,
      byType,
      byArea,
      byHostingProvider,
      homologatedCount,
      manualCount,
      riskAnalysisYes,
      riskAnalysisNo,
      infoSecClauseYes,
      infoSecClauseNo,
      overdueReviews,
      dueSoonReviews,
    ] = await Promise.all([
      this.prisma.softwareInventoryItem.count({ where: { tenantId } }),
      this.prisma.softwareInventoryItem.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
      this.prisma.softwareInventoryItem.groupBy({
        by: ["criticality"],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.softwareInventoryItem.groupBy({ by: ["type"], where: { tenantId }, _count: true }),
      this.prisma.softwareInventoryItem.groupBy({ by: ["areaId"], where: { tenantId }, _count: true }),
      this.prisma.softwareInventoryItem.groupBy({
        by: ["hostingProvider"],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.softwareInventoryItem.count({ where: { tenantId, assessmentId: { not: null } } }),
      this.prisma.softwareInventoryItem.count({ where: { tenantId, assessmentId: null } }),
      this.prisma.softwareInventoryItem.count({ where: { tenantId, hasRiskAnalysis: true } }),
      this.prisma.softwareInventoryItem.count({ where: { tenantId, hasRiskAnalysis: false } }),
      this.prisma.softwareInventoryItem.count({ where: { tenantId, hasInfoSecClause: true } }),
      this.prisma.softwareInventoryItem.count({ where: { tenantId, hasInfoSecClause: false } }),
      this.prisma.softwareInventoryItem.count({
        where: { tenantId, status: "ACTIVE", nextReviewDate: { lt: now } },
      }),
      this.prisma.softwareInventoryItem.count({
        where: { tenantId, status: "ACTIVE", nextReviewDate: { gte: now, lte: dueSoonThreshold } },
      }),
    ]);

    return {
      totalItems,
      byStatus,
      byCriticality,
      byType,
      byArea,
      byHostingProvider,
      homologatedCount,
      manualCount,
      riskAnalysisYes,
      riskAnalysisNo,
      infoSecClauseYes,
      infoSecClauseNo,
      overdueReviews,
      dueSoonReviews,
    };
  }

  update(
    id: string,
    data: Prisma.SoftwareInventoryItemUncheckedUpdateInput,
  ): Promise<InventoryItemDetail> {
    return this.prisma.softwareInventoryItem.update({
      where: { id },
      data,
      include: itemDetailInclude,
    });
  }

  /** Itens ativos cuja revisão vence dentro da janela de aviso — usado pelo job diário. */
  findDueForReview(warningDate: Date) {
    return this.prisma.softwareInventoryItem.findMany({
      where: { status: "ACTIVE", nextReviewDate: { lte: warningDate } },
      include: itemDetailInclude,
    });
  }
}
