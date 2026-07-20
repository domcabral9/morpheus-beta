import { Injectable } from "@nestjs/common";
import { RiskResult } from "@morpheus/database";
import { RiskEngineRepository } from "./risk-engine.repository";
import { RiskEngineService, ScorableAnswer } from "./risk-engine.service";

/**
 * Orquestra o motor de risco (puro/testável em RiskEngineService) com a
 * persistência (RiskEngineRepository) — separação deliberada para manter o
 * cálculo em si livre de dependências de banco.
 */
@Injectable()
export class RiskEvaluationService {
  constructor(
    private readonly riskEngineRepository: RiskEngineRepository,
    private readonly riskEngineService: RiskEngineService,
  ) {}

  async evaluate(
    tenantId: string,
    assessmentVersionId: string,
    answers: ScorableAnswer[],
  ): Promise<RiskResult> {
    const config = await this.riskEngineRepository.findActiveConfig(tenantId);
    const scores = this.riskEngineService.computeScores(answers);
    const classification = this.riskEngineService.classify(config, scores);

    return this.riskEngineRepository.createRiskResult({
      assessmentVersionId,
      riskMatrixConfigId: config.id,
      probabilityScore: classification.probabilityScore,
      impactScore: classification.impactScore,
      totalScore: classification.totalScore,
      probabilityLevelId: classification.probabilityLevelId,
      impactLevelId: classification.impactLevelId,
      riskClassificationId: classification.riskClassificationId,
    });
  }
}
