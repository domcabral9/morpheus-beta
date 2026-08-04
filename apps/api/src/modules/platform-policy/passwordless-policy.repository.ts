import { Injectable } from "@nestjs/common";
import { PlatformPasswordlessPolicy } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const SINGLETON_ID = "singleton";

@Injectable()
export class PasswordlessPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Autocurativo: se a linha não existir (ambiente não seedado), cria com
   * os defaults do schema (`enabled: false`) em vez de falhar.
   */
  getOrCreate(): Promise<PlatformPasswordlessPolicy> {
    return this.prisma.platformPasswordlessPolicy.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  update(enabled: boolean, actingUserId: string): Promise<PlatformPasswordlessPolicy> {
    return this.prisma.platformPasswordlessPolicy.upsert({
      where: { id: SINGLETON_ID },
      update: { enabled, updatedByUserId: actingUserId },
      create: { id: SINGLETON_ID, enabled, updatedByUserId: actingUserId },
    });
  }
}
