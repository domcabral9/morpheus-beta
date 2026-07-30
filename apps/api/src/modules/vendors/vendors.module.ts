import { Module } from "@nestjs/common";
import { RiskEngineModule } from "../risk-engine/risk-engine.module";
import { VendorsController } from "./vendors.controller";
import { VendorsRepository } from "./vendors.repository";
import { VendorsService } from "./vendors.service";

// NotificationsService/AuditLogService são globais, não precisam entrar no
// array de imports. RiskEngineModule entra explicitamente porque
// VendorsService reaproveita o RiskEngineService (função pura de cálculo de
// score) já usado pelo motor de risco de software - sem risco de
// circularidade, RiskEngineModule não depende de VendorsModule.
@Module({
  imports: [RiskEngineModule],
  controllers: [VendorsController],
  providers: [VendorsRepository, VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
