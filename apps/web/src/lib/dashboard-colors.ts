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
