import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RenewalRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Itens de inventário vindos de homologação real (`assessmentId` não nulo)
   * cuja `Assessment` ainda está `APPROVED` - candidatos a entrar em ciclo de
   * renovação. Itens de entrada manual nunca aparecem aqui (fora de escopo
   * da renovação anual).
   */
  findEligibleItems() {
    return this.prisma.softwareInventoryItem.findMany({
      where: {
        assessmentId: { not: null },
        status: { in: ["ACTIVE", "PENDING_REVIEW"] },
        assessment: { status: "APPROVED" },
      },
      include: {
        tenant: true,
        assessment: { include: { requester: true } },
      },
    });
  }

  startRenewalCycle(assessmentId: string, data: { renewalDueAt: Date; renewalCycleStartedAt: Date }) {
    return this.prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: "PENDING_RENEWAL",
        renewalDueAt: data.renewalDueAt,
        renewalCycleStartedAt: data.renewalCycleStartedAt,
      },
    });
  }

  // Papéis seedados (Administrador, Usuário) são únicos por tenant
  // (`@@unique([tenantId, name])`) - proxy pra "quem pode agir no lugar de um
  // solicitante que saiu da empresa" (decisão #4 do plano).
  findAdministradorRoleId(tenantId: string) {
    return this.prisma.role.findFirst({
      where: { tenantId, name: "Administrador" },
      select: { id: true },
    });
  }

  /**
   * Itens ainda não `EXPIRED` cuja `Assessment` está `PENDING_RENEWAL` com o
   * prazo (já ajustado pela janela de fechamento) vencido. Filtrar por
   * `status != EXPIRED` mantém o job idempotente - um item já marcado não é
   * reprocessado (nem renotificado) em execuções seguintes.
   */
  findLapsedItems(now: Date) {
    return this.prisma.softwareInventoryItem.findMany({
      where: {
        status: { not: "EXPIRED" },
        assessment: { status: "PENDING_RENEWAL", renewalDueAt: { lt: now } },
      },
    });
  }

  markExpired(itemId: string) {
    return this.prisma.softwareInventoryItem.update({
      where: { id: itemId },
      data: { status: "EXPIRED" },
    });
  }
}
