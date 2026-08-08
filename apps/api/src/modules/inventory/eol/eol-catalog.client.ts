import { Injectable, Logger } from "@nestjs/common";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";

const BASE_URL = "https://endoflife.date/api/v1";

export interface EolProductSummary {
  slug: string;
  name: string;
}

export interface EolProductDetail {
  slug: string;
  name: string;
  /** Array bruto de releases da API - persistido como está em `EolProduct.cycles`. */
  releases: unknown;
}

interface ProductListEntry {
  name: string;
  label: string;
}

/**
 * Cliente HTTP puro pro endoflife.date - `fetch()` nativo, mesmo idioma dos
 * outros adapters de integração deste projeto (`webhook-itsm.adapter.ts` e
 * família): degrada graciosamente (log + retorno vazio/null) em vez de
 * lançar quando a integração está desabilitada ou a chamada falha, já que um
 * catálogo desatualizado/parcial não pode derrubar o job noturno inteiro.
 */
@Injectable()
export class EolCatalogClient {
  private readonly logger = new Logger(EolCatalogClient.name);

  constructor(private readonly integrationsPolicyService: IntegrationsPolicyService) {}

  async listProducts(): Promise<EolProductSummary[]> {
    const policy = await this.integrationsPolicyService.getPolicy();
    if (!policy.endoflifeEnabled) return [];

    try {
      const response = await fetch(`${BASE_URL}/products`);
      if (!response.ok) {
        this.logger.warn(`endoflife.date GET /products respondeu ${response.status}.`);
        return [];
      }
      const body = (await response.json()) as { result: ProductListEntry[] };
      return body.result.map((entry) => ({ slug: entry.name, name: entry.label }));
    } catch (err) {
      this.logger.warn(`Falha ao listar catálogo do endoflife.date: ${(err as Error).message}`);
      return [];
    }
  }

  async fetchProductDetail(slug: string): Promise<EolProductDetail | null> {
    try {
      const response = await fetch(`${BASE_URL}/products/${encodeURIComponent(slug)}`);
      if (!response.ok) {
        this.logger.warn(`endoflife.date GET /products/${slug} respondeu ${response.status}.`);
        return null;
      }
      const body = (await response.json()) as {
        result: { name: string; label: string; releases: unknown };
      };
      return { slug: body.result.name, name: body.result.label, releases: body.result.releases };
    } catch (err) {
      this.logger.warn(
        `Falha ao buscar produto "${slug}" no endoflife.date: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
