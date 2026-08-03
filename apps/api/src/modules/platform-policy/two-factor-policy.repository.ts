import { Injectable } from "@nestjs/common";
import { PlatformTwoFactorPolicy } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const SINGLETON_ID = "singleton";

@Injectable()
export class TwoFactorPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Autocurativo: se a linha não existir (ambiente não seedado), cria com
   * os defaults do schema (`enforced: false`) em vez de falhar.
   */
  getOrCreate(): Promise<PlatformTwoFactorPolicy> {
    return this.prisma.platformTwoFactorPolicy.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  update(enforced: boolean, actingUserId: string): Promise<PlatformTwoFactorPolicy> {
    return this.prisma.platformTwoFactorPolicy.upsert({
      where: { id: SINGLETON_ID },
      update: { enforced, updatedByUserId: actingUserId },
      create: { id: SINGLETON_ID, enforced, updatedByUserId: actingUserId },
    });
  }
}
