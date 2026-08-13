export interface VendorTierThresholdInput {
  tier: number;
  label: string;
  minScore: number;
  maxScore: number;
}

export interface VendorTierResult {
  tier: number;
  label: string;
}

/**
 * Encontra o tier cujo intervalo [minScore, maxScore] contém `score` -
 * paralelo ao `RiskEngineService.findBand`, mas não reaproveitado
 * diretamente porque `VendorTierThreshold` carrega campos que não cabem no
 * formato genérico `ScoreBand` (tier, label, baseReassessmentMonths). Mesmo
 * fallback defensivo: score fora de todas as faixas usa a mais próxima, pra
 * nunca derrubar a conclusão de uma avaliação por causa de uma configuração
 * de tier incompleta. Retorna `null` só quando não há threshold nenhum
 * configurado - cabe ao chamador decidir como reagir (config mal montada).
 */
export function tierForScore(
  thresholds: VendorTierThresholdInput[],
  score: number,
): VendorTierResult | null {
  if (thresholds.length === 0) return null;

  const match = thresholds.find((t) => score >= t.minScore && score <= t.maxScore);
  if (match) return { tier: match.tier, label: match.label };

  const sorted = [...thresholds].sort((a, b) => a.minScore - b.minScore);
  const lowest = sorted[0]!;
  const highest = sorted[sorted.length - 1]!;
  const fallback = score < lowest.minScore ? lowest : highest;
  return { tier: fallback.tier, label: fallback.label };
}
