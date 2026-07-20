import { Global, Module } from "@nestjs/common";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogRepository } from "./audit-log.repository";
import { AuditLogService } from "./audit-log.service";

/**
 * Global porque `AuditLogService` é usado por quase todo módulo de negócio
 * (auth, assessments, workflow, technical-opinions, CRUDs admin) — mesmo
 * raciocínio do PrismaModule: importar isso módulo a módulo seria só
 * cerimônia sem benefício real de encapsulamento.
 */
@Global()
@Module({
  controllers: [AuditLogController],
  providers: [AuditLogRepository, AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
