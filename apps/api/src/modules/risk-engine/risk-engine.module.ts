import { Module } from "@nestjs/common";
import { RiskEngineRepository } from "./risk-engine.repository";
import { RiskEngineService } from "./risk-engine.service";
import { RiskEvaluationService } from "./risk-evaluation.service";

@Module({
  providers: [RiskEngineRepository, RiskEngineService, RiskEvaluationService],
  exports: [RiskEngineService, RiskEvaluationService],
})
export class RiskEngineModule {}
