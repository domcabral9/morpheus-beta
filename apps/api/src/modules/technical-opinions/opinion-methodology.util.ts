export type MethodologyRiskDimension = "PROBABILITY" | "IMPACT" | "BOTH";

export interface MethodologyScorableAnswer {
  questionText: string;
  weight: number;
  riskDimension: MethodologyRiskDimension;
  /** Score de risco cru da resposta, 0 (sem risco) a 5 (risco máximo) - mesma
   * convenção de `RiskEngineService`/`AssessmentsService.resolveScorableAnswers`. */
  score: number;
}

export interface MethodologyTopFactor {
  questionText: string;
  contributionLabel: string;
}

const DIMENSION_LABELS: Record<MethodologyRiskDimension, string> = {
  PROBABILITY: "Probabilidade",
  IMPACT: "Impacto",
  BOTH: "Probabilidade e Impacto",
};

/**
 * Replica o mesmo cálculo de contribuição já usado pelo motor de risco real
 * (peso × score de risco por resposta, ver `AssessmentsService
 * .resolveScorableAnswers`/`RiskEngineService`) para identificar, dentre as
 * respostas já dadas nesta avaliação específica, quais mais pesaram no
 * resultado final - nunca fabricado, só ordenação de dado real já
 * persistido. Usado na seção "Metodologia" do parecer técnico.
 */
export function computeTopRiskFactors(
  answers: MethodologyScorableAnswer[],
  count = 5,
): MethodologyTopFactor[] {
  return [...answers]
    .sort((a, b) => b.weight * b.score - a.weight * a.score)
    .slice(0, count)
    .map((answer) => ({
      questionText: answer.questionText,
      contributionLabel: `Peso ${answer.weight.toFixed(2)} · Risco ${answer.score.toFixed(1)}/5 · ${DIMENSION_LABELS[answer.riskDimension]}`,
    }));
}
