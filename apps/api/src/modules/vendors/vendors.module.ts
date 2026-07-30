import { Module } from "@nestjs/common";
import { RiskEngineModule } from "../risk-engine/risk-engine.module";
import { VendorsController } from "./vendors.controller";
import { VendorsRepository } from "./vendors.repository";
import { VendorsService } from "./vendors.service";
import { VendorReassessmentScheduler } from "./vendor-reassessment.scheduler";

// NotificationsService/AuditLogService são globais, não precisam entrar no
// array de imports. RiskEngineModule entra explicitamente porque
// VendorsService reaproveita o RiskEngineService (função pura de cálculo de
// score) já usado pelo motor de risco de software - sem risco de
// circularidade, RiskEngineModule não depende de VendorsModule.
// VendorReassessmentScheduler entra aqui dentro (diferente do
// RenewalScheduler, que virou módulo separado especificamente pra evitar
// import circular com AssessmentsModule/InventoryModule) - esse problema não
// existe aqui, VendorsModule já é autocontido.
@Module({
  imports: [RiskEngineModule],
  controllers: [VendorsController],
  providers: [VendorsRepository, VendorsService, VendorReassessmentScheduler],
  exports: [VendorsService],
})
export class VendorsModule {}
