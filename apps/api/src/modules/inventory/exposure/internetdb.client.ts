import { Injectable, Logger } from "@nestjs/common";

const BASE_URL = "https://internetdb.shodan.io";

export interface InternetDbResult {
  ip: string;
  ports: number[];
  cpes: string[];
  hostnames: string[];
  tags: string[];
  vulns: string[];
}

/**
 * Cliente HTTP puro pra Shodan InternetDB - gratuita, sem chave, `fetch()`
 * nativo (mesma convenção do projeto, ver VirusTotalClient/EolCatalogClient).
 * Só consulta passiva (GET) - a InternetDB nunca escaneia nada na hora, só
 * devolve o que a Shodan já tinha indexado antes. IP nunca visto pela Shodan
 * devolve 404, que vira `null` (mesmo princípio de "não adivinhar" já
 * estabelecido no VirusTotalClient) - nunca inventa um resultado "sem
 * exposição" a partir da ausência de dado.
 */
@Injectable()
export class InternetDbClient {
  private readonly logger = new Logger(InternetDbClient.name);

  async lookup(ip: string): Promise<InternetDbResult | null> {
    const endpoint = `${BASE_URL}/${ip}`;
    try {
      const response = await fetch(endpoint);
      if (response.status === 404) return null;
      if (!response.ok) {
        this.logger.warn(`InternetDB ${endpoint} respondeu ${response.status}.`);
        return null;
      }
      return (await response.json()) as InternetDbResult;
    } catch (err) {
      this.logger.warn(`Falha ao consultar a InternetDB (${endpoint}): ${(err as Error).message}`);
      return null;
    }
  }
}
