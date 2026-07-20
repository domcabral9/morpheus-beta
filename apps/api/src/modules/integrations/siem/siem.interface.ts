export const SIEM_ADAPTER = Symbol("SIEM_ADAPTER");

export interface SecurityEvent {
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Abstração de encaminhamento de eventos de segurança para um SIEM externo
 * (Splunk, Sentinel, Elastic Security...) — mesmo raciocínio do
 * StorageAdapter (Etapa 7) e EmailAdapter (Etapa 10): a implementação
 * concreta (hoje um webhook HTTP genérico) fica isolada atrás desta
 * interface, então apontar para um SIEM de verdade não toca em quem chama
 * `send()`. Consumido por AuditLogService — todo evento que já vira AuditLog
 * também é encaminhado aqui, best-effort.
 */
export interface SiemAdapter {
  send(event: SecurityEvent): Promise<void>;
}
