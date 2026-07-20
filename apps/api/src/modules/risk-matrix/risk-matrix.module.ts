import { Module } from "@nestjs/common";
import { RiskMatrixController } from "./risk-matrix.controller";
import { RiskMatrixRepository } from "./risk-matrix.repository";
import { RiskMatrixService } from "./risk-matrix.service";

@Module({
  controllers: [RiskMatrixController],
  providers: [RiskMatrixRepository, RiskMatrixService],
  exports: [RiskMatrixService],
})
export class RiskMatrixModule {}
