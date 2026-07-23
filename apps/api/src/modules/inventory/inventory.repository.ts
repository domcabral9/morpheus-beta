import { Injectable } from "@nestjs/common";
import { Prisma, InventoryStatus } from "@morpheus/database";
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

  async findMany(params: {
    tenantId: string;
    status?: InventoryStatus;
    areaId?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: InventoryItemDetail[]; total: number }> {
    const where: Prisma.SoftwareInventoryItemWhereInput = {
      tenantId: params.tenantId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.areaId ? { areaId: params.areaId } : {}),
    };

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
  findAllMatching(params: {
    tenantId: string;
    status?: InventoryStatus;
    areaId?: string;
  }): Promise<InventoryItemDetail[]> {
    return this.prisma.softwareInventoryItem.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.areaId ? { areaId: params.areaId } : {}),
      },
      include: itemDetailInclude,
      orderBy: { name: "asc" },
    });
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
