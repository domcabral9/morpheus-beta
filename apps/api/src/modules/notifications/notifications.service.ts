import { Inject, Injectable, Logger } from "@nestjs/common";
import { EMAIL_ADAPTER, EmailAdapter } from "./email.interface";
import { NotificationsRepository } from "./notifications.repository";
import {
  NotificationDataByType,
  renderNotificationEmailContent,
} from "./notification-email-content.util";

export interface NotifyInput<T extends keyof NotificationDataByType = keyof NotificationDataByType> {
  tenantId: string;
  userId: string;
  type: T;
  data: NotificationDataByType[T];
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/**
 * Serviço genérico de notificação (Etapa 10): grava em `Notification` e
 * tenta enviar e-mail via `EmailAdapter` - usado tanto pelo workflow (Etapa
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
   * Nunca lança - mesmo raciocínio do AuditLogService: uma falha ao
   * notificar (banco ou SMTP fora do ar) não pode derrubar a ação de negócio
   * que disparou a notificação.
   */
  async notify<T extends keyof NotificationDataByType>(input: NotifyInput<T>): Promise<void> {
    try {
      await this.repository.create(input);
      const user = await this.repository.findUserContact(input.userId);
      if (user?.isActive) {
        const { subject, body } = renderNotificationEmailContent(input.type, input.data);
        await this.emailAdapter.send({ to: user.email, subject, html: `<p>${body}</p>` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao notificar usuário ${input.userId} (${input.type}): ${message}`);
    }
  }

  /** Notifica todos os usuários ativos que hoje possuem o papel informado. */
  async notifyRole<T extends keyof NotificationDataByType>(
    tenantId: string,
    roleId: string,
    data: Omit<NotifyInput<T>, "tenantId" | "userId">,
  ): Promise<void> {
    const users = await this.repository.findUsersByRole(roleId);
    await Promise.all(
      users.map((user) => this.notify<T>({ ...data, tenantId, userId: user.id })),
    );
  }

  /** Notifica todo usuário ativo do tenant que tenha, por qualquer papel, a
   * permissão informada - ver `NotificationsRepository.findUsersByPermission`
   * pra por que isto é diferente de `notifyRole` (aqui o conjunto de papéis
   * concedendo a permissão pode ser >1). */
  async notifyPermissionHolders<T extends keyof NotificationDataByType>(
    tenantId: string,
    permissionKey: string,
    data: Omit<NotifyInput<T>, "tenantId" | "userId">,
  ): Promise<void> {
    const users = await this.repository.findUsersByPermission(tenantId, permissionKey);
    await Promise.all(
      users.map((user) => this.notify<T>({ ...data, tenantId, userId: user.id })),
    );
  }

  /**
   * Envia um e-mail avulso, sem gravar `Notification` (destinatário pode nem
   * estar autenticado ainda, ex. código de login passwordless) e sem ficar
   * amarrado a `NotifyInput`/`NotificationType`. Mesmo não-throw de `notify()`:
   * falha de SMTP vira log, nunca deve derrubar quem chamou.
   */
  async sendRawEmail(input: { to: string; subject: string; html: string }): Promise<void> {
    try {
      await this.emailAdapter.send(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao enviar e-mail avulso para ${input.to}: ${message}`);
    }
  }

  listForUser(userId: string, page: number, pageSize: number) {
    return this.repository.findForUser(userId, page, pageSize);
  }

  markAsRead(id: string, userId: string) {
    return this.repository.markAsRead(id, userId);
  }

  countUnread(userId: string) {
    return this.repository.countUnread(userId);
  }

  markAllAsRead(userId: string) {
    return this.repository.markAllAsRead(userId);
  }
}
