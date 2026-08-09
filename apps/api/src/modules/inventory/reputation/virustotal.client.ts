import { Injectable, Logger } from "@nestjs/common";

const BASE_URL = "https://www.virustotal.com/api/v3";

type Verdict = "CLEAN" | "SUSPICIOUS" | null;

interface AnalysisStats {
  malicious?: number;
  suspicious?: number;
}

function verdictFromStats(stats: AnalysisStats | undefined): Verdict {
  if (!stats) return null;
  return (stats.malicious ?? 0) > 0 || (stats.suspicious ?? 0) > 0 ? "SUSPICIOUS" : "CLEAN";
}

/**
 * Cliente HTTP puro pro VirusTotal - `fetch()` nativo, mesmo idioma dos
 * outros adapters de integração (`webhook-itsm`/`webhook-siem`,
 * `eol-catalog.client`). Só consulta passiva (`GET`) - nunca envia/submete
 * um arquivo ou URL pra análise, o que consumiria cota sem controle e
 * criaria um fluxo assíncrono de poll fora do escopo desta feature. Hash/URL
 * nunca vistos pelo VT devolvem 404, que vira `null` (unverified) - nunca
 * `CLEAN` (ver eol-freshness.util.ts pro mesmo princípio de "não adivinhar").
 */
@Injectable()
export class VirusTotalClient {
  private readonly logger = new Logger(VirusTotalClient.name);

  /** `apiKey` já vem decriptografada de quem chama (`ReputationService`,
   * que lê a policy uma única vez por checagem) - este cliente não sabe
   * nada sobre `PlatformIntegrationsPolicy`, só faz HTTP. */
  async checkHash(sha256: string, apiKey: string): Promise<Verdict> {
    return this.fetchVerdict(`${BASE_URL}/files/${sha256}`, apiKey);
  }

  async checkUrl(url: string, apiKey: string): Promise<Verdict> {
    const urlId = Buffer.from(url, "utf8").toString("base64url");
    return this.fetchVerdict(`${BASE_URL}/urls/${urlId}`, apiKey);
  }

  private async fetchVerdict(endpoint: string, apiKey: string): Promise<Verdict> {
    try {
      const response = await fetch(endpoint, { headers: { "x-apikey": apiKey } });
      if (response.status === 404) return null;
      if (!response.ok) {
        this.logger.warn(`VirusTotal ${endpoint} respondeu ${response.status}.`);
        return null;
      }
      const body = (await response.json()) as {
        data?: { attributes?: { last_analysis_stats?: AnalysisStats } };
      };
      return verdictFromStats(body.data?.attributes?.last_analysis_stats);
    } catch (err) {
      this.logger.warn(`Falha ao consultar o VirusTotal (${endpoint}): ${(err as Error).message}`);
      return null;
    }
  }
}
