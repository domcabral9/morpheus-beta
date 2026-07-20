import { Injectable } from "@nestjs/common";
import { Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const attachmentDetailInclude = {
  uploadedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AttachmentInclude;

export type AttachmentDetail = Prisma.AttachmentGetPayload<{
  include: typeof attachmentDetailInclude;
}>;

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AttachmentUncheckedCreateInput): Promise<AttachmentDetail> {
    return this.prisma.attachment.create({ data, include: attachmentDetailInclude });
  }

  findById(id: string): Promise<AttachmentDetail | null> {
    return this.prisma.attachment.findUnique({ where: { id }, include: attachmentDetailInclude });
  }

  findMany(params: {
    tenantId: string;
    assessmentId?: string;
    inventoryItemId?: string;
  }): Promise<AttachmentDetail[]> {
    return this.prisma.attachment.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.assessmentId ? { assessmentId: params.assessmentId } : {}),
        ...(params.inventoryItemId ? { inventoryItemId: params.inventoryItemId } : {}),
      },
      include: attachmentDetailInclude,
      orderBy: [{ fileName: "asc" }, { version: "desc" }],
    });
  }

  /** Maior versão já enviada para este nome de arquivo, no mesmo pai (assessment ou item de inventário). */
  async findMaxVersion(params: {
    assessmentId?: string;
    inventoryItemId?: string;
    fileName: string;
  }): Promise<number> {
    const latest = await this.prisma.attachment.findFirst({
      where: {
        fileName: params.fileName,
        ...(params.assessmentId ? { assessmentId: params.assessmentId } : {}),
        ...(params.inventoryItemId ? { inventoryItemId: params.inventoryItemId } : {}),
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return latest?.version ?? 0;
  }

  findAssessmentContext(assessmentId: string) {
    return this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, tenantId: true, requesterId: true },
    });
  }

  findInventoryItemContext(inventoryItemId: string) {
    return this.prisma.softwareInventoryItem.findUnique({
      where: { id: inventoryItemId },
      select: { id: true, tenantId: true },
    });
  }
}
