import { Injectable, Logger } from "@nestjs/common";
import { promises as dns } from "node:dns";

function ipToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    result = (result << 8) + n;
  }
  return result >>> 0;
}

const PRIVATE_OR_RESERVED_CIDRS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  // Inclui explicitamente o endpoint de metadados de nuvem (169.254.169.254).
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reservado/broadcast
];

/** Devolve `true` também para IPs mal-formados - trata "não sei parsear" como
 * "não elegível", nunca como "seguro por omissão". */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  const ipInt = ipToUint32(ip);
  if (ipInt === null) return true;
  return PRIVATE_OR_RESERVED_CIDRS.some(([base, prefixLength]) => {
    const baseInt = ipToUint32(base)!;
    const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  });
}

function extractHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    // `url` sem protocolo (ex. "api.exemplo.com/caminho") - tenta de novo
    // assumindo https, mesmo tratamento tolerante já aceito em outros
    // pontos do app pra este campo de texto livre.
    try {
      return new URL(`https://${url}`).hostname;
    } catch {
      return null;
    }
  }
}

/**
 * Resolve um IPv4 público a partir da URL de um item de inventário, pra
 * consultar a Shodan InternetDB (que exige IP, não hostname - diferente do
 * VirusTotal). Só IPv4 nesta v1 - limitação deliberada e documentada, não um
 * bug. Rejeita IPs privados/reservados antes de devolver qualquer coisa pro
 * chamador: isso NÃO é defesa de SSRF (o código nunca faz uma requisição
 * HTTP para o host do item - só resolve DNS localmente e, depois, consulta a
 * Shodan com a *string* do IP como parâmetro de um lookup passivo) - é
 * higiene de dados: a Shodan nunca escaneou rede interna de ninguém, então
 * mandar um IP privado não tem sentido e pode vazar topologia interna à toa.
 */
@Injectable()
export class ExposureHostResolver {
  private readonly logger = new Logger(ExposureHostResolver.name);

  async resolvePublicIpv4(url: string): Promise<string | null> {
    const hostname = extractHostname(url);
    if (!hostname) return null;

    try {
      const { address } = await dns.lookup(hostname, { family: 4 });
      if (isPrivateOrReservedIpv4(address)) return null;
      return address;
    } catch (err) {
      this.logger.warn(`Falha ao resolver DNS para "${hostname}": ${(err as Error).message}`);
      return null;
    }
  }
}
