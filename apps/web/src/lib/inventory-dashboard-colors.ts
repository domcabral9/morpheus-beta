/**
 * Cor por categoria pras dimensões do dashboard de inventário que carregam
 * significado bom/ruim (status do ativo, criticidade, conformidade do
 * fornecedor) - nunca a paleta categórica de 8 tons nesses casos (skill de
 * dataviz: "quando uma série significa bom/ruim, ela usa tokens de status").
 * Dimensões sem significado bom/ruim (tipo, área, provedor de hospedagem,
 * origem homologado/manual) usam um hue categórico único ou fixo, nunca
 * esta função.
 */
const INVENTORY_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--chart-good)",
  PENDING_REVIEW: "var(--chart-warning)",
  EXPIRED: "var(--chart-critical)",
};

const CRITICALITY_COLOR: Record<string, string> = {
  LOW: "var(--chart-good)",
  MEDIUM: "var(--chart-warning)",
  HIGH: "var(--chart-serious)",
  CRITICAL: "var(--chart-critical)",
};

const NEUTRAL = "var(--muted-foreground)";

export function colorForInventoryStatus(status: string): string {
  return INVENTORY_STATUS_COLOR[status] ?? NEUTRAL;
}

export function colorForCriticality(criticality: string): string {
  return CRITICALITY_COLOR[criticality] ?? NEUTRAL;
}

export function colorForCompliance(value: boolean): string {
  return value ? "var(--chart-good)" : "var(--chart-critical)";
}
