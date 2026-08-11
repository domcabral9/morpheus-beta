import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { InventoryModule } from "../inventory/inventory.module";
import { TechnicalOpinionController } from "./technical-opinion.controller";
import { TechnicalOpinionRepository } from "./technical-opinion.repository";
import { TechnicalOpinionService } from "./technical-opinion.service";
import { PdfGeneratorService } from "./pdf-generator.service";

@Module({
  // InventoryModule: enriquecimento do parecer lê o item de inventário
  // recém-criado (frescor/reputação/exposição) - ver TechnicalOpinionService
  // .generateForAssessment. Sem risco de import circular (InventoryModule só
  // importa PlatformPolicyModule/AttachmentsModule/StorageModule).
  imports: [StorageModule, InventoryModule],
  controllers: [TechnicalOpinionController],
  providers: [TechnicalOpinionRepository, TechnicalOpinionService, PdfGeneratorService],
  exports: [TechnicalOpinionService],
})
export class TechnicalOpinionModule {}
