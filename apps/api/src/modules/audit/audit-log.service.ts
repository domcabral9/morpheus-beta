import { Inject, Injectable, Logger } from "@nestjs/common";
import { AuditLogRepository, RecordAuditLogInput, AuditLogFilters } from "./audit-log.repository";
import { SIEM_ADAPTER, SiemAdapter } from "../integrations/siem/siem.interface";

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

  constructor(
    private readonly repository: AuditLogRepository,
    @Inject(SIEM_ADAPTER) private readonly siemAdapter: SiemAdapter,
  ) {}

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

    // Encaminhamento ao SIEM é independente da gravação local — uma falha
    // aqui não deve impedir (nem ser impedida por) o registro em AuditLog.
    try {
      await this.siemAdapter.send({
        tenantId: input.tenantId ?? "unknown",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? "unknown",
        userId: input.userId ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
        occurredAt: new Date(),
        metadata: input.metadata as Record<string, unknown> | undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Falha ao encaminhar evento de auditoria para o SIEM (${input.action} ${input.entityType}): ${message}`,
      );
    }
  }

  list(filters: AuditLogFilters, page: number, pageSize: number) {
    return this.repository.findMany(filters, page, pageSize);
  }
}
