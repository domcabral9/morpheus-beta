import { Module } from "@nestjs/common";
import { SampleDataController } from "./sample-data.controller";
import { SampleDataService } from "./sample-data.service";
import { SampleDataRepository } from "./sample-data.repository";

// Módulo leve, autocontido via PrismaService/AuditLogService (globais) - não
// importa VendorsModule/InventoryModule/AssessmentsModule, mesmo raciocínio
// já usado pelo RenewalModule pra evitar risco de circularidade.
@Module({
  controllers: [SampleDataController],
  providers: [SampleDataService, SampleDataRepository],
})
export class SampleDataModule {}
