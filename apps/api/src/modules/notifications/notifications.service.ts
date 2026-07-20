import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotificationType } from "@morpheus/database";
import { EMAIL_ADAPTER, EmailAdapter } from "./email.interface";
import { NotificationsRepository } from "./notifications.repository";

export interface NotifyInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/**
 * Serviço genérico de notificação (Etapa 10): grava em `Notification` e
 * tenta enviar e-mail via `EmailAdapter` — usado tanto pelo workflow (Etapa
 * 6: nova etapa/aprovação/reprovação/ajuste), pelo parecer técnico (Etapa 7:
 * emitido) quanto pela revisão periódica de inventário, em vez de cada
 * módulo reimplementar o próprio envio.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationsRepository,
    @Inject(EMAIL_ADAPTER) private readonly emailAdapter: EmailAdapter,
  ) {}

  /**
   * Nunca lança — mesmo raciocínio do AuditLogService: uma falha ao
   * notificar (banco ou SMTP fora do ar) não pode derrubar a ação de negócio
   * que disparou a notificação.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.repository.create(input);
      const user = await this.repository.findUserContact(input.userId);
      if (user?.isActive) {
        await this.emailAdapter.send({
          to: user.email,
          subject: input.title,
          html: `<p>${input.body}</p>`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao notificar usuário ${input.userId} (${input.type}): ${message}`);
    }
  }

  /** Notifica todos os usuários ativos que hoje possuem o papel informado. */
  async notifyRole(
    tenantId: string,
    roleId: string,
    data: Omit<NotifyInput, "tenantId" | "userId">,
  ): Promise<void> {
    const users = await this.repository.findUsersByRole(roleId);
    await Promise.all(users.map((user) => this.notify({ ...data, tenantId, userId: user.id })));
  }

  listForUser(userId: string, page: number, pageSize: number) {
    return this.repository.findForUser(userId, page, pageSize);
  }

  markAsRead(id: string, userId: string) {
    return this.repository.markAsRead(id, userId);
  }
}
