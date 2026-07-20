import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import type { ActiveRiskMatrixConfig } from "./risk-engine.repository";

export type RiskDimensionInput = "PROBABILITY" | "IMPACT" | "BOTH";

export interface ScorableAnswer {
  riskDimension: RiskDimensionInput;
  /** Peso da pergunta (importância relativa). */
  weight: number;
  /** Contribuição de risco da resposta, 0 (sem risco) a 5 (risco máximo). */
  score: number;
}

export interface RiskScores {
  probabilityScore: number;
  impactScore: number;
  totalScore: number;
}

export interface RiskClassificationResult extends RiskScores {
  probabilityLevelId: string;
  impactLevelId: string;
  riskClassificationId: string;
}

interface ScoreBand {
  id: string;
  minScore: unknown;
  maxScore: unknown;
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Motor de risco: calcula os scores de probabilidade/impacto/total a partir
 * das respostas de uma avaliação e classifica o resultado contra a matriz
 * configurável do tenant. Sem regra fixa no código — pesos, faixas e
 * classificações vêm todos de RiskMatrixConfig (parametrizável pelo admin),
 * conforme o requisito de "Motor de Regras" do sistema.
 */
@Injectable()
export class RiskEngineService {
  /**
   * Convenção: `score` de entrada é RISCO cru (0 = seguro, 5 = risco máximo)
   * — mais intuitivo para o admin configurar "quão arriscada é esta
   * resposta" na Etapa 4 (questionnaire admin). A saída inverte para SCORE
   * DE SEGURANÇA (0 a 5, quanto maior melhor), mesma convenção do motor n8n
   * já em produção na empresa (`risk_score: 4.1` = bom).
   */
  computeScores(answers: ScorableAnswer[]): RiskScores {
    const probabilityItems = answers.filter(
      (a) => a.riskDimension === "PROBABILITY" || a.riskDimension === "BOTH",
    );
    const impactItems = answers.filter(
      (a) => a.riskDimension === "IMPACT" || a.riskDimension === "BOTH",
    );

    const probabilityRisk = this.weightedAverageRisk(probabilityItems);
    const impactRisk = this.weightedAverageRisk(impactItems);
    const totalRisk = this.weightedAverageRisk(answers);

    return {
      probabilityScore: clamp(5 - probabilityRisk, 0, 5),
      impactScore: clamp(5 - impactRisk, 0, 5),
      totalScore: clamp(5 - totalRisk, 0, 5),
    };
  }

  classify(config: ActiveRiskMatrixConfig, scores: RiskScores): RiskClassificationResult {
    return {
      ...scores,
      probabilityLevelId: this.findBand(config.probabilityLevels, scores.probabilityScore).id,
      impactLevelId: this.findBand(config.impactLevels, scores.impactScore).id,
      riskClassificationId: this.findBand(config.riskClassifications, scores.totalScore).id,
    };
  }

  private weightedAverageRisk(items: ScorableAnswer[]): number {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) {
      // Sem perguntas pontuáveis nesta dimensão (ex.: categoria só com
      // perguntas TEXT) — não há base para presumir risco, trata como
      // neutro/seguro em vez de derrubar o cálculo por divisão por zero.
      return 0;
    }
    const weightedSum = items.reduce((sum, item) => sum + item.score * item.weight, 0);
    return weightedSum / totalWeight;
  }

  private findBand<T extends ScoreBand>(bands: T[], score: number): T {
    if (bands.length === 0) {
      throw new UnprocessableEntityException(
        "A matriz de risco ativa não tem faixas configuradas — contate o administrador.",
      );
    }

    const match = bands.find(
      (band) => score >= toNumber(band.minScore) && score <= toNumber(band.maxScore),
    );
    if (match) return match;

    // Fallback defensivo: score fora de todas as faixas configuradas (matriz
    // mal configurada pelo admin, com gaps) — usa a faixa mais próxima em vez
    // de derrubar o envio da avaliação por causa de uma configuração
    // incompleta da matriz.
    const sorted = [...bands].sort((a, b) => toNumber(a.minScore) - toNumber(b.minScore));
    const lowest = sorted[0]!;
    const highest = sorted[sorted.length - 1]!;
    return score < toNumber(lowest.minScore) ? lowest : highest;
  }
}
