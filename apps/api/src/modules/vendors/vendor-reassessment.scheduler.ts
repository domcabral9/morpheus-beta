import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { VendorsRepository } from "./vendors.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogService } from "../audit/audit-log.service";

/**
 * Job diário de aviso de reavaliação de fornecedor vencida (Fase 3 do plano
 * de avaliação de fornecedores). Roda depois dos jobs de renovação anual
 * (6h15/6h30) - pra cada `Vendor` ativo já avaliado (`currentTier` não nulo)
 * cuja `nextReviewDueAt` já passou, notifica quem concluiu a última
 * `VendorAssessment` (se ainda ativo), senão o papel "Administrador" - mesmo
 * padrão duplo do `RenewalScheduler.checkRenewalTriggers`. Não reabre nada
 * nem muda `Vendor.currentTier` - só avisa; uma nova avaliação concluída é
 * quem de fato atualiza o tier (`VendorsService.completeAssessment`), que
 * também limpa `reassessmentNotifiedAt` pra permitir o próximo aviso.
 */
@Injectable()
export class VendorReassessmentScheduler {
  private readonly logger = new Logger(VendorReassessmentScheduler.name);

  constructor(
    private readonly repository: VendorsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Cron("45 6 * * *")
  async checkReassessmentsDue(): Promise<void> {
    const now = new Date();
    const vendors = await this.repository.findDueForReassessment(now);

    for (const vendor of vendors) {
      const lastAssessment = vendor.assessments[0];
      const performer = lastAssessment?.performedBy;

      if (performer?.isActive) {
        await this.notificationsService.notify({
          tenantId: vendor.tenantId,
          userId: performer.id,
          type: "VENDOR_REASSESSMENT_DUE",
          title: `Reavaliação pendente: ${vendor.name}`,
          body: `A reavaliação de risco do fornecedor "${vendor.name}" (Tier ${vendor.currentTier} · ${vendor.currentTierLabel}) venceu. Inicie uma nova avaliação.`,
          relatedEntityType: "Vendor",
          relatedEntityId: vendor.id,
        });
      } else {
        // Quem concluiu a última avaliação está inativo (ou nunca houve uma
        // registrada) - notifica quem pode agir no lugar (papel
        // "Administrador", mesmo proxy do RenewalScheduler).
        const adminRole = await this.repository.findAdministradorRoleId(vendor.tenantId);
        if (adminRole) {
          await this.notificationsService.notifyRole(vendor.tenantId, adminRole.id, {
            type: "VENDOR_REASSESSMENT_DUE",
            title: `Reavaliação pendente: ${vendor.name}`,
            body: `A reavaliação de risco do fornecedor "${vendor.name}" (Tier ${vendor.currentTier} · ${vendor.currentTierLabel}) venceu. O responsável pela última avaliação está inativo - inicie uma nova avaliação ou reatribua.`,
            relatedEntityType: "Vendor",
            relatedEntityId: vendor.id,
          });
        }
      }

      await this.repository.markReassessmentNotified(vendor.id, now);

      await this.auditLogService.record({
        tenantId: vendor.tenantId,
        action: "UPDATE",
        entityType: "Vendor",
        entityId: vendor.id,
        metadata: {
          reason: "reassessment_due_notified",
          nextReviewDueAt: vendor.nextReviewDueAt?.toISOString(),
          currentTier: vendor.currentTier,
        },
      });
    }

    if (vendors.length > 0) {
      this.logger.log(
        `Reavaliação de fornecedor vencida: ${vendors.length} aviso(s) disparado(s).`,
      );
    }
  }
}
