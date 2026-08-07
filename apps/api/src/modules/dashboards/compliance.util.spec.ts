import { aggregateComplianceSubjects, ComplianceSubject } from "./compliance.util";

function subject(
  answers: Array<{
    type: "SCALE" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "TEXT";
    scaleValue?: number | null;
    selectedOptionScores?: number[];
    controlIds: string[];
  }>,
): ComplianceSubject {
  return {
    answers: answers.map((a) => ({
      type: a.type,
      scaleValue: a.scaleValue ?? null,
      selectedOptionScores: a.selectedOptionScores ?? [],
      controlIds: a.controlIds,
    })),
  };
}

describe("aggregateComplianceSubjects", () => {
  it("controle sem nenhuma resposta pontuável não aparece no resultado", () => {
    const result = aggregateComplianceSubjects([subject([{ type: "TEXT", controlIds: ["c1"] }])]);
    expect(result.has("c1")).toBe(false);
  });

  it("uma resposta favorável (score <= 1) conta como atendido", () => {
    const result = aggregateComplianceSubjects([
      subject([{ type: "SCALE", scaleValue: 0, controlIds: ["c1"] }]),
    ]);
    expect(result.get("c1")).toEqual({ met: 1, total: 1 });
  });

  it("uma resposta desfavorável (score > 1) conta como avaliado mas não atendido", () => {
    const result = aggregateComplianceSubjects([
      subject([{ type: "SCALE", scaleValue: 3, controlIds: ["c1"] }]),
    ]);
    expect(result.get("c1")).toEqual({ met: 0, total: 1 });
  });

  it("SINGLE_CHOICE usa o score da opção selecionada", () => {
    const result = aggregateComplianceSubjects([
      subject([{ type: "SINGLE_CHOICE", selectedOptionScores: [0.5], controlIds: ["c1"] }]),
    ]);
    expect(result.get("c1")).toEqual({ met: 1, total: 1 });
  });

  it("MULTI_CHOICE usa a média dos scores das opções selecionadas", () => {
    const result = aggregateComplianceSubjects([
      subject([{ type: "MULTI_CHOICE", selectedOptionScores: [0, 4], controlIds: ["c1"] }]),
    ]);
    // média = 2, acima do limiar de 1 -> não atendido
    expect(result.get("c1")).toEqual({ met: 0, total: 1 });
  });

  it("duas perguntas vinculadas ao mesmo controle no mesmo sujeito: TODAS precisam ser favoráveis", () => {
    const result = aggregateComplianceSubjects([
      subject([
        { type: "SCALE", scaleValue: 0, controlIds: ["c1"] },
        { type: "SCALE", scaleValue: 3, controlIds: ["c1"] },
      ]),
    ]);
    expect(result.get("c1")).toEqual({ met: 0, total: 1 });
  });

  it("duas perguntas vinculadas ao mesmo controle, ambas favoráveis: atendido", () => {
    const result = aggregateComplianceSubjects([
      subject([
        { type: "SCALE", scaleValue: 0, controlIds: ["c1"] },
        { type: "SCALE", scaleValue: 1, controlIds: ["c1"] },
      ]),
    ]);
    expect(result.get("c1")).toEqual({ met: 1, total: 1 });
  });

  it("agrega através de múltiplos sujeitos (software + fornecedor juntos)", () => {
    const result = aggregateComplianceSubjects([
      subject([{ type: "SCALE", scaleValue: 0, controlIds: ["c1"] }]), // sujeito software, atendido
      subject([{ type: "SCALE", scaleValue: 4, controlIds: ["c1"] }]), // sujeito fornecedor, não atendido
    ]);
    expect(result.get("c1")).toEqual({ met: 1, total: 2 });
  });

  it("uma pergunta pode alimentar mais de um controle simultaneamente", () => {
    const result = aggregateComplianceSubjects([
      subject([{ type: "SCALE", scaleValue: 0, controlIds: ["c1", "c2"] }]),
    ]);
    expect(result.get("c1")).toEqual({ met: 1, total: 1 });
    expect(result.get("c2")).toEqual({ met: 1, total: 1 });
  });

  it("respeita um threshold customizado", () => {
    const result = aggregateComplianceSubjects(
      [subject([{ type: "SCALE", scaleValue: 2, controlIds: ["c1"] }])],
      2,
    );
    expect(result.get("c1")).toEqual({ met: 1, total: 1 });
  });
});
