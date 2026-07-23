import { Module } from "@nestjs/common";
import { RenewalRepository } from "./renewal.repository";
import { RenewalScheduler } from "./renewal.scheduler";

// Módulo leve, autocontido via PrismaService (global) - não importa
// AssessmentsModule/InventoryModule pra evitar risco de circularidade no
// grafo de imports (AssessmentsModule não tem acesso direto a
// InventoryService hoje). NotificationsService/AuditLogService também são
// globais, então não precisam entrar no array de imports.
@Module({
  providers: [RenewalRepository, RenewalScheduler],
})
export class RenewalModule {}
