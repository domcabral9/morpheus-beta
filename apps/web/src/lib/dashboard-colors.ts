/**
 * Cor por categoria quando a categoria já carrega um significado bom/ruim
 * (status de avaliação, classificação de parecer) - nunca a paleta
 * categórica de 8 tons nesses casos (ver skill de dataviz: "quando uma
 * série significa bom/ruim, ela usa tokens de status, nunca categórica").
 * Estágios intermediários (ainda não decididos) ficam num cinza neutro -
 * não são "mais uma categoria", são só "ainda em andamento".
 */
const STATUS_OUTCOME_COLOR: Record<string, string> = {
  APPROVED: "var(--chart-good)",
  Homologado: "var(--chart-good)",
  REJECTED: "var(--chart-critical)",
  Rejeitado: "var(--chart-critical)",
  PENDING_ADJUSTMENT: "var(--chart-warning)",
  "Aguardando Ajustes": "var(--chart-warning)",
};

const NEUTRAL_IN_PROGRESS = "var(--muted-foreground)";

export function colorForOutcomeKey(key: string): string {
  return STATUS_OUTCOME_COLOR[key] ?? NEUTRAL_IN_PROGRESS;
}

/**
 * Cor por faixa de percentual atendido (dashboard de conformidade) - usa os
 * 4 tokens de status reservados (good/warning/serious/critical), nunca a
 * paleta categórica, pelo mesmo motivo de `colorForOutcomeKey`: o percentual
 * já carrega um significado bom/ruim. `null` (controle nunca avaliado) usa o
 * mesmo cinza neutro de "ainda em andamento".
 */
export function colorForCompliancePercentage(percentage: number | null): string {
  if (percentage === null) return NEUTRAL_IN_PROGRESS;
  if (percentage >= 0.8) return "var(--chart-good)";
  if (percentage >= 0.5) return "var(--chart-warning)";
  if (percentage >= 0.2) return "var(--chart-serious)";
  return "var(--chart-critical)";
}
