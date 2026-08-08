import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { EolCatalogClient } from "./eol-catalog.client";
import { EolCatalogRepository } from "./eol-catalog.repository";

/**
 * Sincroniza o cache local do catálogo do endoflife.date (~462 produtos) -
 * roda depois do pipeline diário já existente (revisão 6:00, renovação
 * 6:15/6:30, reavaliação de fornecedor 6:45). Busca sequencial (não
 * paralela) de propósito - é uma API estática/cacheada em CDN, não precisa
 * de paralelismo, e sequencial já é "não martelar" por natureza. Falha num
 * produto individual (já logada no client) não aborta o resto da sincronização.
 */
@Injectable()
export class EolCatalogScheduler {
  private readonly logger = new Logger(EolCatalogScheduler.name);

  constructor(
    private readonly client: EolCatalogClient,
    private readonly repository: EolCatalogRepository,
  ) {}

  @Cron("0 7 * * *")
  async syncCatalog(): Promise<void> {
    const products = await this.client.listProducts();
    if (products.length === 0) {
      return; // integração desabilitada ou falha ao listar (já logado no client)
    }

    let synced = 0;
    for (const product of products) {
      const detail = await this.client.fetchProductDetail(product.slug);
      if (!detail) continue;
      await this.repository.upsertOne(detail.slug, detail.name, detail.releases);
      synced += 1;
    }

    this.logger.log(`Catálogo endoflife.date sincronizado: ${synced}/${products.length} produtos.`);
  }
}
