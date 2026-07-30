export type BusinessCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const CRITICALITY_MULTIPLIER: Record<BusinessCriticality, number> = {
  LOW: 1.5,
  MEDIUM: 1.0,
  HIGH: 0.75,
  CRITICAL: 0.5,
};

const MIN_MONTHS = 3;
const MAX_MONTHS = 12;

/**
 * Cadência de reavaliação de fornecedor (decisão #5 do plano de avaliação de
 * fornecedores): intervalo base do tier (`VendorTierThreshold.
 * baseReassessmentMonths`, configurável por tenant) ajustado por um
 * multiplicador FIXO no código de criticidade de negócio do fornecedor —
 * simplificação deliberada pra v1, evita duplicar uma segunda matriz inteira
 * só pra isso. Resultado sempre clampado entre 3 e 12 meses, mesmo com
 * criticidade ausente (trata como MEDIUM, multiplicador neutro 1.0).
 */
export function computeNextReviewDate(
  baseMonths: number,
  criticality: BusinessCriticality | null | undefined,
  from: Date,
): Date {
  const multiplier = CRITICALITY_MULTIPLIER[criticality ?? "MEDIUM"];
  const months = Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, Math.round(baseMonths * multiplier)));
  const result = new Date(from);
  result.setMonth(result.getMonth() + months);
  return result;
}
