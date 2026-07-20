import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { SecurityEvent, SiemAdapter } from "./siem.interface";

/**
 * Sem SIEM_WEBHOOK_URL configurado, `send()` só loga um aviso — mesmo padrão
 * do SmtpEmailAdapter (Etapa 10): dev/CI não precisam de um SIEM de verdade
 * rodando. Chamador (AuditLogService) já trata qualquer erro daqui como
 * não-fatal.
 */
@Injectable()
export class WebhookSiemAdapter implements SiemAdapter {
  private readonly logger = new Logger(WebhookSiemAdapter.name);
  private readonly webhookUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>("SIEM_WEBHOOK_URL");
  }

  async send(event: SecurityEvent): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn(
        `SIEM_WEBHOOK_URL não configurado — evento ${event.action} ${event.entityType} não encaminhado (só logado).`,
      );
      return;
    }

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      throw new Error(`SIEM respondeu ${response.status} ao encaminhar evento de segurança.`);
    }
  }
}
