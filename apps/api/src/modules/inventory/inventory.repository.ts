import { Injectable } from "@nestjs/common";
import { Prisma, InventoryStatus } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const itemDetailInclude = {
  area: true,
  manager: { select: { id: true, name: true, email: true } },
  technicalResponsible: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SoftwareInventoryItemInclude;

export type InventoryItemDetail = Prisma.SoftwareInventoryItemGetPayload<{
  include: typeof itemDetailInclude;
}>;

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SoftwareInventoryItemUncheckedCreateInput): Promise<InventoryItemDetail> {
    return this.prisma.softwareInventoryItem.create({ data, include: itemDetailInclude });
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
