import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { RenewalRepository } from "./renewal.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogService } from "../audit/audit-log.service";
import { computeRenewalTrigger } from "./renewal-window.util";

/**
 * Job diário de gatilho de renovação anual (Fase 3 do plano de renovação).
 * Roda depois do `InventoryReviewScheduler` (6h) - pra cada item elegível
 * (homologado, ainda `APPROVED`), calcula o gatilho efetivo (já ajustado
 * pela janela de fechamento anual do tenant, ver `renewal-window.util.ts`) e
 * reabre a `Assessment` original em `PENDING_RENEWAL` quando o gatilho já
 * passou. Disparo por borda: a query só olha `Assessment.status = APPROVED`,
 * então uma vez reaberta, o item não é reprocessado até o ciclo se resolver.
 */
@Injectable()
export class RenewalScheduler {
  private readonly logger = new Logger(RenewalScheduler.name);

  constructor(
    private readonly repository: RenewalRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Cron("15 6 * * *")
  async checkRenewalTriggers(): Promise<void> {
    const now = new Date();
    const items = await this.repository.findEligibleItems();
    let triggeredCount = 0;

    for (const item of items) {
      const assessment = item.assessment;
      if (!assessment) continue;

      const { gatilhoEfetivo, vencimentoEfetivo } = computeRenewalTrigger(item.nextReviewDate, {
        enabled: item.tenant.annualClosingWindowEnabled,
        start: item.tenant.annualClosingWindowStart,
        end: item.tenant.annualClosingWindowEnd,
      });

      if (gatilhoEfetivo > now) continue;
      triggeredCount++;

      await this.repository.startRenewalCycle(assessment.id, {
        renewalDueAt: vencimentoEfetivo,
        renewalCycleStartedAt: now,
      });

      const deadlineLabel = vencimentoEfetivo.toLocaleDateString("pt-BR");
      const requester = assessment.requester;
      if (requester.isActive) {
        await this.notificationsService.notify({
          tenantId: item.tenantId,
          userId: requester.id,
          type: "RENEWAL_PENDING",
          title: `Renovação pendente: ${item.name}`,
          body: `A homologação de "${item.name}" (${item.vendor}) venceu e entrou em ciclo de renovação. Prazo para revisar e reenviar: ${deadlineLabel}.`,
          relatedEntityType: "Assessment",
          relatedEntityId: assessment.id,
        });
      } else {
        // Solicitante original inativo (proxy pra "saiu da empresa") - notifica
        // quem pode reatribuir (papel "Administrador", decisão #4 do plano).
        const adminRole = await this.repository.findAdministradorRoleId(item.tenantId);
        if (adminRole) {
          await this.notificationsService.notifyRole(item.tenantId, adminRole.id, {
            type: "RENEWAL_PENDING",
            title: `Renovação pendente (solicitante inativo): ${item.name}`,
            body: `A homologação de "${item.name}" (${item.vendor}) entrou em ciclo de renovação, mas o solicitante original está inativo. Reatribua um novo solicitante. Prazo: ${deadlineLabel}.`,
            relatedEntityType: "Assessment",
            relatedEntityId: assessment.id,
          });
        }
      }

      await this.auditLogService.record({
        tenantId: item.tenantId,
        action: "REOPEN",
        entityType: "Assessment",
        entityId: assessment.id,
        metadata: {
          reason: "renewal_cycle_started",
          renewalDueAt: vencimentoEfetivo.toISOString(),
          softwareName: item.name,
        },
      });
    }

    if (triggeredCount > 0) {
      this.logger.log(`Gatilho de renovação anual: ${triggeredCount} avaliação(ões) reaberta(s).`);
    }
  }
}
