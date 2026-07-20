import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { TechnicalOpinionController } from "./technical-opinion.controller";
import { TechnicalOpinionRepository } from "./technical-opinion.repository";
import { TechnicalOpinionService } from "./technical-opinion.service";
import { PdfGeneratorService } from "./pdf-generator.service";

@Module({
  imports: [StorageModule],
  controllers: [TechnicalOpinionController],
  providers: [TechnicalOpinionRepository, TechnicalOpinionService, PdfGeneratorService],
  exports: [TechnicalOpinionService],
})
export class TechnicalOpinionModule {}
