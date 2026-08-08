import { Injectable } from "@nestjs/common";
import { EolProduct, Prisma } from "@morpheus/database";
import { PrismaService } from "../../../prisma/prisma.service";

const SEARCH_LIMIT = 10;

@Injectable()
export class EolCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  search(query: string): Promise<EolProduct[]> {
    return this.prisma.eolProduct.findMany({
      where: {
        OR: [
          { slug: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: SEARCH_LIMIT,
    });
  }

  findBySlug(slug: string): Promise<EolProduct | null> {
    return this.prisma.eolProduct.findUnique({ where: { slug } });
  }

  /**
   * Upsert um por um (não em lote) - a sincronização já busca cada produto
   * individualmente no cliente HTTP, então gravar assim que cada resposta
   * chega preserva progresso parcial se o job for interrompido no meio,
   * em vez de perder a sincronização inteira.
   */
  upsertOne(slug: string, name: string, releases: unknown): Promise<EolProduct> {
    const cycles = releases as Prisma.InputJsonValue;
    return this.prisma.eolProduct.upsert({
      where: { slug },
      update: { name, cycles, lastSyncedAt: new Date() },
      create: { slug, name, cycles, lastSyncedAt: new Date() },
    });
  }
}
