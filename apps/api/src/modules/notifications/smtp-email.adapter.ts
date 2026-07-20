import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailAdapter, EmailMessage } from "./email.interface";

/**
 * Sem SMTP_HOST configurado, o transporte simplesmente não é criado e
 * `send()` só loga um aviso — dev/CI não precisam de um servidor SMTP de
 * verdade para o resto da aplicação funcionar. `NotificationsService` já
 * trata qualquer erro daqui como não-fatal (mesmo padrão do
 * AuditLogService), então isso também cobre falhas reais de envio em
 * produção sem derrubar a ação de negócio que disparou a notificação.
 */
@Injectable()
export class SmtpEmailAdapter implements EmailAdapter {
  private readonly logger = new Logger(SmtpEmailAdapter.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("SMTP_HOST");
    this.from = this.configService.get<string>("SMTP_FROM", "Morpheus <no-reply@morpheus.local>");

    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: this.configService.get<number>("SMTP_PORT", 587),
          secure: this.configService.get<boolean>("SMTP_SECURE", false),
          auth: this.configService.get<string>("SMTP_USER")
            ? {
                user: this.configService.get<string>("SMTP_USER"),
                pass: this.configService.get<string>("SMTP_PASSWORD"),
              }
            : undefined,
        })
      : null;
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP_HOST não configurado — e-mail para ${message.to} não enviado (só logado).`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
  }
}
