export type ReputationState =
  "verified-clean" | "verified-suspicious" | "declared-known" | "unverified";

interface ReputationStateInput {
  reputationLastCheckedAt: Date | null;
  reputationVerdict: "CLEAN" | "SUSPICIOUS" | null;
  reputationDeclaredKnown: boolean;
}

/** Prioridade: uma checagem automática já feita sempre fala mais alto que a
 * flag declarada (dado real > declaração manual). Sem checagem, a flag
 * declarada é o fallback pros casos óbvios sem artefato pra checar de
 * verdade. Sem nenhum dos dois, `unverified` - nunca inventa um veredito. */
export function computeReputationState(input: ReputationStateInput): ReputationState {
  if (input.reputationLastCheckedAt && input.reputationVerdict) {
    return input.reputationVerdict === "CLEAN" ? "verified-clean" : "verified-suspicious";
  }
  if (input.reputationDeclaredKnown) return "declared-known";
  return "unverified";
}
