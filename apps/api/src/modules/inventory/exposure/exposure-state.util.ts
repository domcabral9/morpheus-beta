import type { InternetDbResult } from "./internetdb.client";

export type ExposureState = "exposed" | "no-known-vulnerabilities" | "unverified";

interface ExposureStateInput {
  exposureLastCheckedAt: Date | null;
  exposureRawData: InternetDbResult | null;
}

/**
 * Ausência de dado nunca vira um veredito positivo (mesmo princípio de
 * `computeReputationState`/`computeFreshness`): sem checagem, sem IP público
 * resolvível, IP privado rejeitado, ou 404 da InternetDB - tudo isso é
 * `unverified`, nunca `no-known-vulnerabilities`. Só uma checagem concluída
 * com dado real determina se há vulnerabilidade conhecida ou não.
 */
export function computeExposureState(input: ExposureStateInput): ExposureState {
  if (!input.exposureLastCheckedAt || !input.exposureRawData) return "unverified";
  return input.exposureRawData.vulns.length > 0 ? "exposed" : "no-known-vulnerabilities";
}
