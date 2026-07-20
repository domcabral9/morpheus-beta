import { Injectable, Logger } from "@nestjs/common";
import { AuditLogRepository, RecordAuditLogInput, AuditLogFilters } from "./audit-log.repository";

/**
 * Registro de auditoria (Etapa 8). Dois jeitos de acionar, conforme o caso:
 * - `@Audit()` + `AuditInterceptor` para CRUDs simples e estáticos (a ação e
 *   o tipo de entidade já são conhecidos em tempo de desenvolvimento).
 * - Chamada explícita a `record()` para eventos de negócio cuja ação real só
 *   é conhecida em runtime (ex.: login, decisão de workflow que pode ser
 *   aprovar/reprovar/pedir ajuste, download de parecer).
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly repository: AuditLogRepository) {}

  /**
   * Nunca lança — uma falha ao gravar auditoria não pode derrubar a ação de
   * negócio sendo auditada. Erros viram só log de aplicação.
   */
  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      await this.repository.create(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Falha ao gravar log de auditoria (${input.action} ${input.entityType}): ${message}`,
      );
    }
  }

  list(filters: AuditLogFilters, page: number, pageSize: number) {
    return this.repository.findMany(filters, page, pageSize);
  }
}
