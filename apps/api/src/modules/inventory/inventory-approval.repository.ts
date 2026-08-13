import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { itemDetailInclude, InventoryItemDetail } from "./inventory.repository";

@Injectable()
export class InventoryApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByItemId(inventoryItemId: string) {
    return this.prisma.inventoryApprovalRequest.findUnique({ where: { inventoryItemId } });
  }

  markDecided(
    id: string,
    data: { status: "APPROVED" | "REJECTED"; decidedById: string; decisionNotes: string | null },
  ) {
    return this.prisma.inventoryApprovalRequest.update({
      where: { id },
      data: { ...data, decidedAt: new Date() },
    });
  }

  resetForResubmit(id: string) {
    return this.prisma.inventoryApprovalRequest.update({
      where: { id },
      data: { status: "PENDING", decidedById: null, decidedAt: null, decisionNotes: null },
    });
  }

  /** Fila de aprovadores - itens `PENDING_APPROVAL`, mais antigos primeiro
   * (mesmo espírito de fila do `/workflow/inbox`). Reaproveita `itemDetailInclude`,
   * que já traz `approvalRequest` (com `requester`) selecionado. */
  findPendingItems(tenantId: string): Promise<InventoryItemDetail[]> {
    return this.prisma.softwareInventoryItem.findMany({
      where: { tenantId, status: "PENDING_APPROVAL" },
      include: itemDetailInclude,
      orderBy: { createdAt: "asc" },
    });
  }
}
