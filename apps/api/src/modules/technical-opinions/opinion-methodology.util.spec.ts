import { computeTopRiskFactors, MethodologyScorableAnswer } from "./opinion-methodology.util";

function makeAnswer(overrides: Partial<MethodologyScorableAnswer> = {}): MethodologyScorableAnswer {
  return {
    questionText: "Pergunta padrão",
    weight: 5,
    riskDimension: "BOTH",
    score: 2,
    ...overrides,
  };
}

describe("computeTopRiskFactors", () => {
  it("ordena por peso × score de risco, do maior contribuinte para o menor", () => {
    const answers = [
      makeAnswer({ questionText: "Baixa contribuição", weight: 2, score: 1 }), // 2
      makeAnswer({ questionText: "Alta contribuição", weight: 8, score: 4 }), // 32
      makeAnswer({ questionText: "Contribuição média", weight: 5, score: 3 }), // 15
    ];

    const result = computeTopRiskFactors(answers);

    expect(result.map((factor) => factor.questionText)).toEqual([
      "Alta contribuição",
      "Contribuição média",
      "Baixa contribuição",
    ]);
  });

  it("respeita o limite `count`, cortando o restante", () => {
    const answers = [
      makeAnswer({ questionText: "A", weight: 10, score: 5 }),
      makeAnswer({ questionText: "B", weight: 8, score: 4 }),
      makeAnswer({ questionText: "C", weight: 6, score: 3 }),
    ];

    const result = computeTopRiskFactors(answers, 2);

    expect(result).toHaveLength(2);
    expect(result.map((factor) => factor.questionText)).toEqual(["A", "B"]);
  });

  it("mantém a ordem original em caso de empate (sort estável)", () => {
    const answers = [
      makeAnswer({ questionText: "Primeira", weight: 4, score: 2 }), // 8
      makeAnswer({ questionText: "Segunda", weight: 2, score: 4 }), // 8 (empate)
    ];

    const result = computeTopRiskFactors(answers);

    expect(result.map((factor) => factor.questionText)).toEqual(["Primeira", "Segunda"]);
  });

  it("devolve lista vazia quando não há respostas pontuáveis", () => {
    expect(computeTopRiskFactors([])).toEqual([]);
  });

  it("formata o rótulo de contribuição com peso, score e dimensão traduzida", () => {
    const result = computeTopRiskFactors([
      makeAnswer({
        questionText: "A empresa possui política de backup?",
        weight: 8,
        riskDimension: "IMPACT",
        score: 4,
      }),
    ]);

    expect(result[0]).toEqual({
      questionText: "A empresa possui política de backup?",
      contributionLabel: "Peso 8.00 · Risco 4.0/5 · Impacto",
    });
  });
});
