import { UnprocessableEntityException } from "@nestjs/common";
import { RiskEngineService, ScorableAnswer } from "./risk-engine.service";
import type { ActiveRiskMatrixConfig } from "./risk-engine.repository";

function makeConfig(overrides?: Partial<ActiveRiskMatrixConfig>): ActiveRiskMatrixConfig {
  const probabilityLevels = [
    { id: "prob-alta", minScore: 0, maxScore: 1.66 },
    { id: "prob-media", minScore: 1.67, maxScore: 3.33 },
    { id: "prob-baixa", minScore: 3.34, maxScore: 5 },
  ];
  const impactLevels = [
    { id: "imp-alto", minScore: 0, maxScore: 1.66 },
    { id: "imp-medio", minScore: 1.67, maxScore: 3.33 },
    { id: "imp-baixo", minScore: 3.34, maxScore: 5 },
  ];
  const riskClassifications = [
    { id: "rejeitado", minScore: 0, maxScore: 2.99 },
    { id: "ajustes", minScore: 3.0, maxScore: 3.99 },
    { id: "homologado", minScore: 4.0, maxScore: 5.0 },
  ];

  return {
    probabilityLevels,
    impactLevels,
    riskClassifications,
    ...overrides,
  } as unknown as ActiveRiskMatrixConfig;
}

describe("RiskEngineService", () => {
  let service: RiskEngineService;

  beforeEach(() => {
    service = new RiskEngineService();
  });

  describe("computeScores", () => {
    it("inverte risco cru (0=seguro,5=risco) para score de segurança (0=ruim,5=bom)", () => {
      const answers: ScorableAnswer[] = [
        { riskDimension: "BOTH", weight: 1, score: 0 }, // sem risco algum
      ];
      const scores = service.computeScores(answers);
      expect(scores.totalScore).toBe(5);
      expect(scores.probabilityScore).toBe(5);
      expect(scores.impactScore).toBe(5);
    });

    it("calcula média ponderada por peso", () => {
      const answers: ScorableAnswer[] = [
        { riskDimension: "BOTH", weight: 3, score: 5 }, // risco máximo, peso alto
        { riskDimension: "BOTH", weight: 1, score: 0 }, // sem risco, peso baixo
      ];
      // risco ponderado = (5*3 + 0*1) / 4 = 3.75 -> score = 5 - 3.75 = 1.25
      const scores = service.computeScores(answers);
      expect(scores.totalScore).toBeCloseTo(1.25);
    });

    it("separa contribuições de PROBABILITY e IMPACT, com BOTH entrando nas duas", () => {
      const answers: ScorableAnswer[] = [
        { riskDimension: "PROBABILITY", weight: 1, score: 5 }, // só afeta probabilidade
        { riskDimension: "IMPACT", weight: 1, score: 0 }, // só afeta impacto
        { riskDimension: "BOTH", weight: 1, score: 2 }, // afeta as duas e o total
      ];
      const scores = service.computeScores(answers);
      // probabilidade: risco médio (5*1 + 2*1)/2 = 3.5 -> score 1.5
      expect(scores.probabilityScore).toBeCloseTo(1.5);
      // impacto: risco médio (0*1 + 2*1)/2 = 1 -> score 4
      expect(scores.impactScore).toBeCloseTo(4);
      // total: risco médio (5+0+2)/3 = 2.333 -> score 2.667
      expect(scores.totalScore).toBeCloseTo(5 - 7 / 3);
    });

    it("trata dimensão sem perguntas pontuáveis como neutra (score 5), sem dividir por zero", () => {
      const answers: ScorableAnswer[] = [{ riskDimension: "IMPACT", weight: 1, score: 5 }];
      const scores = service.computeScores(answers);
      expect(scores.probabilityScore).toBe(5);
      expect(scores.impactScore).toBe(0);
    });

    it("nunca produz score fora do intervalo [0,5]", () => {
      const answers: ScorableAnswer[] = [{ riskDimension: "BOTH", weight: 1, score: 5 }];
      const scores = service.computeScores(answers);
      expect(scores.totalScore).toBeGreaterThanOrEqual(0);
      expect(scores.totalScore).toBeLessThanOrEqual(5);
    });
  });

  describe("classify", () => {
    it("classifica como Homologado quando totalScore >= 4.0", () => {
      const config = makeConfig();
      const result = service.classify(config, {
        probabilityScore: 4.5,
        impactScore: 4.5,
        totalScore: 4.5,
      });
      expect(result.riskClassificationId).toBe("homologado");
      expect(result.probabilityLevelId).toBe("prob-baixa");
      expect(result.impactLevelId).toBe("imp-baixo");
    });

    it("classifica como Aguardando Ajustes na faixa intermediária", () => {
      const config = makeConfig();
      const result = service.classify(config, {
        probabilityScore: 3.5,
        impactScore: 3.5,
        totalScore: 3.5,
      });
      expect(result.riskClassificationId).toBe("ajustes");
    });

    it("classifica como Rejeitado abaixo de 3.0", () => {
      const config = makeConfig();
      const result = service.classify(config, {
        probabilityScore: 1.0,
        impactScore: 1.0,
        totalScore: 1.0,
      });
      expect(result.riskClassificationId).toBe("rejeitado");
      expect(result.probabilityLevelId).toBe("prob-alta");
      expect(result.impactLevelId).toBe("imp-alto");
    });

    it("usa a faixa mais próxima como fallback defensivo se o score cair fora de todas as faixas", () => {
      const config = makeConfig({
        riskClassifications: [
          { id: "so-uma-faixa", minScore: 2, maxScore: 3 },
        ] as unknown as ActiveRiskMatrixConfig["riskClassifications"],
      });
      const result = service.classify(config, {
        probabilityScore: 4.5,
        impactScore: 4.5,
        totalScore: 4.5, // acima da única faixa configurada (max 3)
      });
      expect(result.riskClassificationId).toBe("so-uma-faixa");
    });

    it("lança UnprocessableEntityException se a matriz não tiver faixas configuradas", () => {
      const config = makeConfig({
        riskClassifications: [] as unknown as ActiveRiskMatrixConfig["riskClassifications"],
      });
      expect(() =>
        service.classify(config, { probabilityScore: 4, impactScore: 4, totalScore: 4 }),
      ).toThrow(UnprocessableEntityException);
    });
  });
});
