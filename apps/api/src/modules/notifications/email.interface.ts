export const EMAIL_ADAPTER = Symbol("EMAIL_ADAPTER");

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/**
 * Abstração de envio de e-mail — mesmo raciocínio do StorageAdapter (Etapa
 * 7): a implementação concreta (SMTP hoje, talvez SES/SendGrid amanhã) fica
 * isolada atrás desta interface, então trocar de provedor não toca em quem
 * consome `EmailAdapter`.
 */
export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}
