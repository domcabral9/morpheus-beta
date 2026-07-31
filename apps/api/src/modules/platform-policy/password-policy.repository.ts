import { Injectable } from "@nestjs/common";
import { PlatformPasswordPolicy } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdatePasswordPolicyDto } from "./dto/update-password-policy.dto";

const SINGLETON_ID = "singleton";

@Injectable()
export class PasswordPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Autocurativo: se a linha do seed nunca existiu (ex.: ambiente não
   * seedado), cria com os defaults do schema em vez de falhar.
   */
  getOrCreate(): Promise<PlatformPasswordPolicy> {
    return this.prisma.platformPasswordPolicy.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  update(dto: UpdatePasswordPolicyDto, actingUserId: string): Promise<PlatformPasswordPolicy> {
    return this.prisma.platformPasswordPolicy.upsert({
      where: { id: SINGLETON_ID },
      update: { ...dto, updatedByUserId: actingUserId },
      create: { id: SINGLETON_ID, ...dto, updatedByUserId: actingUserId },
    });
  }
}
