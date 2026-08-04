import { Injectable } from "@nestjs/common";
import { OneTimeCode, OneTimeCodePurpose } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Repository genérico sobre `OneTimeCode` — tabela compartilhada por
 * EMAIL_VERIFICATION (EmailVerificationService) e PASSWORDLESS_LOGIN
 * (PasswordlessService, Fase 3), não duplicada por propósito (ver plano).
 */
@Injectable()
export class OneTimeCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  createCode(
    userId: string,
    purpose: OneTimeCodePurpose,
    codeHash: string,
    expiresAt: Date,
  ): Promise<OneTimeCode> {
    return this.prisma.oneTimeCode.create({ data: { userId, purpose, codeHash, expiresAt } });
  }

  /** Mais recente primeiro — se houver mais de um código ativo do mesmo
   * propósito (pedidos repetidos sem consumir o anterior), só o último conta. */
  findActiveCode(userId: string, purpose: OneTimeCodePurpose): Promise<OneTimeCode | null> {
    return this.prisma.oneTimeCode.findFirst({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.prisma.oneTimeCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.oneTimeCode.update({ where: { id }, data: { usedAt: new Date() } });
  }
}
