/**
 * Limiar de score (escala 0-5, 0 = sem risco) abaixo do qual uma resposta é
 * considerada favorável ao controle que ela avalia. Decisão de escopo
 * confirmada com o usuário: binário, não uma faixa gradual.
 */
export const COMPLIANCE_SCORE_THRESHOLD = 1;

export interface ComplianceAnswerInput {
  type: "SCALE" | "SINGLE_CHOICE" | "MULTI_CHOICE" | "TEXT";
  scaleValue: number | null;
  /** Scores das opções selecionadas (já resolvidos para número) - vazio se nenhuma. */
  selectedOptionScores: number[];
  /** IDs dos Control vinculados à pergunta desta resposta (QuestionControl/VendorQuestionControl). */
  controlIds: string[];
}

export interface ComplianceSubject {
  answers: ComplianceAnswerInput[];
}

export interface ControlAggregate {
  /** Sujeitos (software ou fornecedor) em que o controle foi avaliado e ficou favorável em TODAS as respostas vinculadas. */
  met: number;
  /** Sujeitos em que o controle foi avaliado (pelo menos uma resposta vinculada e pontuável). */
  total: number;
}

function resolveAnswerScore(answer: ComplianceAnswerInput): number | null {
  if (answer.type === "TEXT") return null;
  if (answer.type === "SCALE") return answer.scaleValue ?? null;
  if (answer.selectedOptionScores.length === 0) return null;
  const sum = answer.selectedOptionScores.reduce((acc, score) => acc + score, 0);
  return sum / answer.selectedOptionScores.length;
}

/**
 * Agrega respostas de N sujeitos (cada um a última avaliação de software
 * APPROVED, ou a última avaliação de fornecedor COMPLETED) em um veredito de
 * "controle atendido" por sujeito, depois soma em contagens met/total por
 * controle. Regra confirmada com o usuário: quando um controle é avaliado por
 * mais de uma pergunta dentro do MESMO sujeito, TODAS as respostas vinculadas
 * precisam ser favoráveis (score <= threshold) para contar como atendido -
 * uma resposta desfavorável já derruba o veredito daquele sujeito para aquele
 * controle.
 */
export function aggregateComplianceSubjects(
  subjects: ComplianceSubject[],
  threshold: number = COMPLIANCE_SCORE_THRESHOLD,
): Map<string, ControlAggregate> {
  const result = new Map<string, ControlAggregate>();

  for (const subject of subjects) {
    const scoresByControl = new Map<string, number[]>();

    for (const answer of subject.answers) {
      const score = resolveAnswerScore(answer);
      if (score === null) continue;

      for (const controlId of answer.controlIds) {
        const scores = scoresByControl.get(controlId) ?? [];
        scores.push(score);
        scoresByControl.set(controlId, scores);
      }
    }

    for (const [controlId, scores] of scoresByControl) {
      const aggregate = result.get(controlId) ?? { met: 0, total: 0 };
      aggregate.total += 1;
      if (scores.every((score) => score <= threshold)) aggregate.met += 1;
      result.set(controlId, aggregate);
    }
  }

  return result;
}
