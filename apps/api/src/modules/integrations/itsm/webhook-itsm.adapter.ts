import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CreateTicketInput, ItsmAdapter, TicketResult } from "./itsm.interface";

/**
 * Sem ITSM_WEBHOOK_URL configurado, gera um id local (`local-<uuid>`) e só
 * loga — mesmo padrão do WebhookSiemAdapter. Quem chama `createTicket()`
 * decide se o retorno é usado (ex.: guardado em metadata de auditoria) ou
 * apenas descartado.
 */
@Injectable()
export class WebhookItsmAdapter implements ItsmAdapter {
  private readonly logger = new Logger(WebhookItsmAdapter.name);
  private readonly webhookUrl?: string;
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>("ITSM_WEBHOOK_URL");
    this.apiKey = this.configService.get<string>("ITSM_API_KEY");
  }

  async createTicket(input: CreateTicketInput): Promise<TicketResult> {
    if (!this.webhookUrl) {
      const ticketId = `local-${randomUUID()}`;
      this.logger.warn(
        `ITSM_WEBHOOK_URL não configurado — chamado "${input.title}" não aberto de verdade (id local ${ticketId}).`,
      );
      return { ticketId };
    }

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(`ITSM respondeu ${response.status} ao criar chamado.`);
    }
    const body = (await response.json()) as { ticketId?: string };
    return { ticketId: body.ticketId ?? `unknown-${randomUUID()}` };
  }
}
