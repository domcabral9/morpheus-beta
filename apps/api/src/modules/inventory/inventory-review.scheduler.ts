import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { InventoryRepository } from "./inventory.repository";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Job diário de revisão periódica (Etapa 10): marca itens ACTIVE como
 * PENDING_REVIEW quando a revisão está a menos de N dias do vencimento e
 * notifica gestor + responsável técnico. Disparo por borda (edge-triggered):
 * como a consulta só olha itens ainda ACTIVE, um item já marcado
 * PENDING_REVIEW não é notificado de novo todo dia até alguém agir sobre
 * ele — sem precisar de um campo extra tipo "última notificação".
 */
@Injectable()
export class InventoryReviewScheduler {
  private readonly logger = new Logger(InventoryReviewScheduler.name);

  constructor(
    private readonly repository: InventoryRepository,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async checkExpiringReviews(): Promise<void> {
    const warningDays = this.configService.get<number>("INVENTORY_REVIEW_WARNING_DAYS", 30);
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + warningDays);

    const dueItems = await this.repository.findDueForReview(warningDate);
    if (dueItems.length > 0) {
      this.logger.log(`Revisão periódica de inventário: ${dueItems.length} item(ns) a notificar.`);
    }

    for (const item of dueItems) {
      await this.repository.update(item.id, { status: "PENDING_REVIEW" });

      const recipientIds = new Set([item.managerId, item.technicalResponsibleId]);
      for (const userId of recipientIds) {
        await this.notificationsService.notify({
          tenantId: item.tenantId,
          userId,
          type: "HOMOLOGATION_EXPIRING",
          title: `Revisão pendente: ${item.name}`,
          body: `O item "${item.name}" (${item.vendor}) está com a revisão periódica vencendo em ${item.nextReviewDate.toLocaleDateString("pt-BR")}. Revise a homologação.`,
          relatedEntityType: "SoftwareInventoryItem",
          relatedEntityId: item.id,
        });
      }
    }
  }
}
