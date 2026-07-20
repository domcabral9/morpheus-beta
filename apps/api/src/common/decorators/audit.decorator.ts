import { SetMetadata } from "@nestjs/common";
import type { AuditAction } from "@morpheus/database";

export const AUDIT_KEY = "auditMetadata";

export interface AuditMetadata {
  action: AuditAction;
  entityType: string;
}

/**
 * Marca uma rota para auditoria automática via `AuditInterceptor` — usar só
 * quando ação e tipo de entidade são estáticos e conhecidos em tempo de
 * desenvolvimento (CRUDs simples). Eventos cuja ação real depende de dados
 * da requisição (ex.: decisão de workflow, login) chamam
 * `AuditLogService.record()` explicitamente em vez deste decorator.
 */
export const Audit = (action: AuditAction, entityType: string) =>
  SetMetadata(AUDIT_KEY, { action, entityType } satisfies AuditMetadata);
