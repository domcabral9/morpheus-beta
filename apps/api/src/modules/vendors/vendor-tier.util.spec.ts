import { tierForScore, VendorTierThresholdInput } from "./vendor-tier.util";

const THRESHOLDS: VendorTierThresholdInput[] = [
  { tier: 1, label: "Baixo risco", minScore: 4.0, maxScore: 5.0 },
  { tier: 2, label: "Risco moderado", minScore: 3.0, maxScore: 3.99 },
  { tier: 3, label: "Risco elevado", minScore: 2.0, maxScore: 2.99 },
  { tier: 4, label: "Risco crítico", minScore: 0, maxScore: 1.99 },
];

describe("tierForScore", () => {
  it("retorna null quando não há thresholds configurados", () => {
    expect(tierForScore([], 4.5)).toBeNull();
  });

  it("classifica score dentro da faixa exata do Tier 1 (melhor cenário)", () => {
    expect(tierForScore(THRESHOLDS, 4.5)).toEqual({ tier: 1, label: "Baixo risco" });
  });

  it("classifica score no limite superior de uma faixa (5.0 -> Tier 1)", () => {
    expect(tierForScore(THRESHOLDS, 5.0)).toEqual({ tier: 1, label: "Baixo risco" });
  });

  it("classifica score no limite inferior de uma faixa (0 -> Tier 4)", () => {
    expect(tierForScore(THRESHOLDS, 0)).toEqual({ tier: 4, label: "Risco crítico" });
  });

  it("score alto -> tier baixo/melhor (inverso da escala numérica, decisão #4 do plano)", () => {
    const highScoreTier = tierForScore(THRESHOLDS, 4.2)!.tier;
    const lowScoreTier = tierForScore(THRESHOLDS, 2.5)!.tier;
    expect(highScoreTier).toBeLessThan(lowScoreTier);
  });

  it("score meio-termo cai no Tier 3", () => {
    expect(tierForScore(THRESHOLDS, 2.5)).toEqual({ tier: 3, label: "Risco elevado" });
  });

  it("fallback defensivo: score acima de todas as faixas usa a mais próxima (Tier 1)", () => {
    const gappy = [{ tier: 1, label: "Único", minScore: 0, maxScore: 3 }];
    expect(tierForScore(gappy, 4.9)).toEqual({ tier: 1, label: "Único" });
  });

  it("fallback defensivo: score abaixo de todas as faixas usa a mais próxima", () => {
    const gappy = [{ tier: 1, label: "Único", minScore: 2, maxScore: 5 }];
    expect(tierForScore(gappy, -1)).toEqual({ tier: 1, label: "Único" });
  });
});
