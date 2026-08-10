import { Injectable } from "@nestjs/common";
import { PlatformIntegrationsPolicy } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const SINGLETON_ID = "singleton";

export interface IntegrationsPolicyUpdateData {
  virusTotalApiKeyEncrypted?: string;
  virusTotalEnabled?: boolean;
  virusTotalDailyBudget?: number;
  endoflifeEnabled?: boolean;
  internetDbEnabled?: boolean;
}

@Injectable()
export class IntegrationsPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Autocurativo: se a linha não existir (ambiente não seedado), cria com
   * os defaults do schema em vez de falhar.
   */
  getOrCreate(): Promise<PlatformIntegrationsPolicy> {
    return this.prisma.platformIntegrationsPolicy.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  /**
   * `data` só carrega os campos que o service decidiu mudar - qualquer campo
   * ausente aqui fica intocado no `update` do upsert (é assim que a chave
   * sobrevive a um PATCH que só mexeu em outro campo, ao contrário das
   * demais policies de plataforma, que sempre sobrescrevem tudo).
   */
  update(
    data: IntegrationsPolicyUpdateData,
    actingUserId: string,
  ): Promise<PlatformIntegrationsPolicy> {
    return this.prisma.platformIntegrationsPolicy.upsert({
      where: { id: SINGLETON_ID },
      update: { ...data, updatedByUserId: actingUserId },
      create: { id: SINGLETON_ID, ...data, updatedByUserId: actingUserId },
    });
  }
}
