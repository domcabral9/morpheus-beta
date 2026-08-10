import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";
import { InventoryRepository } from "../inventory.repository";
import { ExposureService } from "./exposure.service";

const STALE_AFTER_DAYS = 30;
/** Rede de segurança operacional, não uma regra de negócio (diferente do
 * orçamento diário da reputação) - evita que uma base de itens muito grande
 * faça uma única execução da varredura durar horas. */
const MAX_ITEMS_PER_SWEEP = 100;
/** Ritmo interno responsável (~1 req/s) - a InternetDB é gratuita/sem chave
 * e não documenta um teto tipo "500/dia", então não há orçamento pra
 * consumir atomicamente aqui, só a cortesia de não martelar a API. */
const PACE_DELAY_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Varredura noturna de exposição externa - itens com URL cadastrada, nunca
 * checados ou vencidos há mais de 30 dias. Roda depois da varredura de
 * reputação (7:15), às 7:30 - próximo slot livre no pipeline noturno
 * (review 6:00 → renewal 6:15/6:30 → vendor reassessment 6:45 → endoflife
 * sync 7:00 → reputation sweep 7:15 → exposure sweep 7:30). Erro por item é
 * logado e pulado, nunca aborta o resto da varredura.
 */
@Injectable()
export class ExposureSweepScheduler {
  private readonly logger = new Logger(ExposureSweepScheduler.name);

  constructor(
    private readonly repository: InventoryRepository,
    private readonly exposureService: ExposureService,
    private readonly integrationsPolicyService: IntegrationsPolicyService,
  ) {}

  @Cron("30 7 * * *")
  async sweep(): Promise<void> {
    const policy = await this.integrationsPolicyService.getPolicy();
    if (!policy.internetDbEnabled) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_AFTER_DAYS);
    const dueItems = (await this.repository.findDueForExposureCheck(cutoff)).slice(
      0,
      MAX_ITEMS_PER_SWEEP,
    );

    let checked = 0;
    for (const item of dueItems) {
      try {
        await this.exposureService.performCheck(item, null);
        checked += 1;
      } catch (err) {
        this.logger.warn(
          `Falha ao checar exposição externa do item ${item.id}: ${(err as Error).message}`,
        );
      }
      await sleep(PACE_DELAY_MS);
    }

    if (dueItems.length > 0) {
      this.logger.log(
        `Varredura de exposição externa: ${checked}/${dueItems.length} item(ns) checado(s).`,
      );
    }
  }
}
