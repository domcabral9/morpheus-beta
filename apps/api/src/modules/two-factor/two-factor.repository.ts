import { Injectable } from "@nestjs/common";
import { Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const totpStateSelect = {
  email: true,
  passwordHash: true,
  totpSecret: true,
  totpPendingSecret: true,
  totpEnabled: true,
} satisfies Prisma.UserSelect;

export type TotpState = Prisma.UserGetPayload<{ select: typeof totpStateSelect }>;

@Injectable()
export class TwoFactorRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTotpState(userId: string): Promise<TotpState | null> {
    return this.prisma.user.findUnique({ where: { id: userId }, select: totpStateSelect });
  }

  async setPendingSecret(userId: string, encryptedSecret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpPendingSecret: encryptedSecret },
    });
  }

  async commitEnrollment(userId: string, encryptedSecret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encryptedSecret, totpEnabled: true, totpPendingSecret: null },
    });
  }

  async disable(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpPendingSecret: null, totpEnabled: false },
    });
  }

  /** Substitui o lote inteiro de códigos de backup - os antigos deixam de
   * existir (não só "ficam inválidos"), mesma transação pra nunca deixar o
   * usuário num estado intermediário sem nenhum código válido. */
  async replaceBackupCodes(userId: string, codeHashes: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
      this.prisma.twoFactorBackupCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  }

  findUnusedBackupCodes(userId: string): Promise<Array<{ id: string; codeHash: string }>> {
    return this.prisma.twoFactorBackupCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, codeHash: true },
    });
  }

  async markBackupCodeUsed(id: string): Promise<void> {
    await this.prisma.twoFactorBackupCode.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteAllBackupCodes(userId: string): Promise<void> {
    await this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } });
  }
}
