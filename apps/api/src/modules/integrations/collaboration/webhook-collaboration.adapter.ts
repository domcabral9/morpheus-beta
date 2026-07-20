import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CollaborationAdapter, CollaborationMessage } from "./collaboration.interface";

/**
 * Sem COLLABORATION_WEBHOOK_URL configurado, só loga — mesmo padrão dos
 * demais adapters desta etapa. Formato do corpo (`{ text }`) é compatível
 * com o formato mínimo de incoming webhook do Slack e do Teams; um provedor
 * que exija outro formato troca só esta classe, não a interface.
 */
@Injectable()
export class WebhookCollaborationAdapter implements CollaborationAdapter {
  private readonly logger = new Logger(WebhookCollaborationAdapter.name);
  private readonly webhookUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>("COLLABORATION_WEBHOOK_URL");
  }

  async postMessage(message: CollaborationMessage): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn(
        `COLLABORATION_WEBHOOK_URL não configurado — mensagem para #${message.channel} não postada (só logada).`,
      );
      return;
    }

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.text }),
    });
    if (!response.ok) {
      throw new Error(`Webhook de colaboração respondeu ${response.status}.`);
    }
  }
}
