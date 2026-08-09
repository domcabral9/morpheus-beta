import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";
import { InventoryRepository } from "../inventory.repository";
import { ReputationService, ReputationBudgetExhaustedException } from "./reputation.service";

const STALE_AFTER_DAYS = 30;

/**
 * Varredura noturna de reputação - itens nunca checados ou vencidos há mais
 * de 30 dias, até o orçamento diário se esgotar. Roda depois do sync do
 * catálogo endoflife.date (7:00), às 7:15. Para cedo assim que o orçamento
 * acaba (`ReputationBudgetExhaustedException`) em vez de continuar tentando
 * e falhando item por item - qualquer outra falha individual (ex.: VT fora
 * do ar pra um item específico) é logada e pulada, não aborta o resto.
 */
@Injectable()
export class ReputationSweepScheduler {
  private readonly logger = new Logger(ReputationSweepScheduler.name);

  constructor(
    private readonly repository: InventoryRepository,
    private readonly reputationService: ReputationService,
    private readonly integrationsPolicyService: IntegrationsPolicyService,
  ) {}

  @Cron("15 7 * * *")
  async sweep(): Promise<void> {
    const policy = await this.integrationsPolicyService.getPolicy();
    if (!policy.virusTotalEnabled) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_AFTER_DAYS);
    const dueItems = await this.repository.findDueForReputationCheck(cutoff);

    let checked = 0;
    for (const item of dueItems) {
      try {
        await this.reputationService.performCheck(item, null);
        checked += 1;
      } catch (err) {
        if (err instanceof ReputationBudgetExhaustedException) break;
        this.logger.warn(`Falha ao checar reputação do item ${item.id}: ${(err as Error).message}`);
      }
    }

    if (dueItems.length > 0) {
      this.logger.log(`Varredura de reputação: ${checked}/${dueItems.length} item(ns) checado(s).`);
    }
  }
}
