export type FreshnessState = "up-to-date" | "outdated" | "unknown";

interface EolRelease {
  name: string;
  isEol: boolean;
  latest: { name: string } | null;
}

function isEolRelease(value: unknown): value is EolRelease {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.name !== "string" || typeof candidate.isEol !== "boolean") return false;
  if (candidate.latest === null) return true;
  return (
    typeof candidate.latest === "object" &&
    candidate.latest !== null &&
    typeof (candidate.latest as Record<string, unknown>).name === "string"
  );
}

/**
 * Comparação deliberadamente conservadora (ver plano/CHANGELOG do arco de
 * enriquecimento): a API do endoflife.date devolve *ciclos* de release (ex.
 * Python 3.14/3.13/3.12, cada um com seu próprio `latest`), não uma versão
 * única - a versão de um item pode pertencer a um ciclo já EOL mesmo com um
 * ciclo mais novo existindo. Fazer o match certo do ciclo (não só "o mais
 * novo") exigiria parsing de prefixo de versão por produto, com esquemas de
 * versionamento muito variados entre os ~462 produtos rastreados - por isso
 * o match aqui é só igualdade exata ou prefixo direto (`"3.14.7"` bate com o
 * ciclo `"3.14"`, nunca tenta ordenar/comparar semver). Sem match claro,
 * devolve "unknown" em vez de arriscar um veredito errado - um "não sei"
 * honesto é melhor que um "desatualizado"/"em dia" incorreto.
 */
export function computeFreshness(itemVersion: string | null, cycles: unknown): FreshnessState {
  if (!itemVersion || !Array.isArray(cycles)) return "unknown";

  const trimmedVersion = itemVersion.trim();
  if (!trimmedVersion) return "unknown";

  const releases = cycles.filter(isEolRelease);
  const matchingRelease = releases.find(
    (release) => trimmedVersion === release.name || trimmedVersion.startsWith(`${release.name}.`),
  );
  if (!matchingRelease || !matchingRelease.latest) return "unknown";

  if (matchingRelease.isEol) return "outdated";
  return trimmedVersion === matchingRelease.latest.name ? "up-to-date" : "outdated";
}
