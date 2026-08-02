import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import * as QRCode from "qrcode";
import { CryptoService } from "../../common/services/crypto/crypto.service";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import type { UserWithPermissions } from "../users/users.repository";
import { TwoFactorRepository } from "./two-factor.repository";
import {
  generateBackupCodes,
  generateTotpSecret,
  buildOtpauthUri,
  verifyTotpCode,
} from "./two-factor.util";

const BACKUP_CODE_HASH_COST = 12;

export interface TwoFactorSetup {
  secretBase32: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
}

export interface TwoFactorEnrollmentResult {
  backupCodes: string[];
}

export interface VerifyLoginCodeResult {
  viaBackupCode: boolean;
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly repository: TwoFactorRepository,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async beginSetup(actor: AuthenticatedUser): Promise<TwoFactorSetup> {
    const state = await this.repository.findTotpState(actor.id);
    if (!state) throw new NotFoundException("Usuário não encontrado.");
    if (!state.passwordHash) {
      throw new BadRequestException(
        "Este usuário não tem senha local; o acesso é só via SSO. 2FA se aplica só ao login local.",
      );
    }
    if (state.totpEnabled) {
      throw new BadRequestException("2FA já está habilitado. Desative antes de reconfigurar.");
    }

    const secretBase32 = generateTotpSecret();
    const otpauthUri = buildOtpauthUri(state.email, secretBase32);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

    await this.repository.setPendingSecret(actor.id, this.cryptoService.encrypt(secretBase32));

    return { secretBase32, otpauthUri, qrCodeDataUrl };
  }

  async confirmSetup(actor: AuthenticatedUser, code: string): Promise<TwoFactorEnrollmentResult> {
    const state = await this.repository.findTotpState(actor.id);
    if (!state) throw new NotFoundException("Usuário não encontrado.");
    if (!state.totpPendingSecret) {
      throw new BadRequestException(
        "Nenhuma configuração de 2FA em andamento. Chame o setup primeiro.",
      );
    }

    const secretBase32 = this.cryptoService.decrypt(state.totpPendingSecret);
    if (!verifyTotpCode(secretBase32, code)) {
      throw new BadRequestException("Código inválido.");
    }

    await this.repository.commitEnrollment(actor.id, state.totpPendingSecret);
    const backupCodes = await this.replaceBackupCodes(actor.id);

    await this.auditLogService.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: actor.id,
      metadata: { field: "twoFactor", event: "enabled" },
    });

    return { backupCodes };
  }

  async disable(actor: AuthenticatedUser, currentPassword: string): Promise<void> {
    await this.reauthenticate(actor.id, currentPassword);

    await this.repository.disable(actor.id);
    await this.repository.deleteAllBackupCodes(actor.id);

    await this.auditLogService.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: actor.id,
      metadata: { field: "twoFactor", event: "disabled" },
    });
  }

  async regenerateBackupCodes(
    actor: AuthenticatedUser,
    currentPassword: string,
  ): Promise<TwoFactorEnrollmentResult> {
    const state = await this.reauthenticate(actor.id, currentPassword);
    if (!state.totpEnabled) {
      throw new BadRequestException("2FA não está habilitado.");
    }

    const backupCodes = await this.replaceBackupCodes(actor.id);

    await this.auditLogService.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: actor.id,
      metadata: { field: "twoFactor", event: "backupCodesRegenerated" },
    });

    return { backupCodes };
  }

  /**
   * Chamado pelo fluxo de login (Fase 3) - `user` já vem com `totpSecret`
   * cru (campo escalar do model `User`, presente em `UserWithPermissions`).
   * Nunca audita tentativa falha (mesmo padrão de `validateLocalUser`/
   * `changeOwnPassword`) - o rate-limit da rota já cobre esse ângulo.
   */
  async verifyLoginCode(
    user: UserWithPermissions,
    rawCode: string,
  ): Promise<VerifyLoginCodeResult> {
    if (!user.totpSecret) {
      throw new UnauthorizedException("2FA não está configurado para este usuário.");
    }

    const secretBase32 = this.cryptoService.decrypt(user.totpSecret);
    if (verifyTotpCode(secretBase32, rawCode)) {
      return { viaBackupCode: false };
    }

    const unused = await this.repository.findUnusedBackupCodes(user.id);
    for (const candidate of unused) {
      if (await bcrypt.compare(rawCode, candidate.codeHash)) {
        await this.repository.markBackupCodeUsed(candidate.id);
        return { viaBackupCode: true };
      }
    }

    throw new UnauthorizedException("Código inválido.");
  }

  private async replaceBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = generateBackupCodes();
    const hashes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, BACKUP_CODE_HASH_COST)),
    );
    await this.repository.replaceBackupCodes(userId, hashes);
    return backupCodes;
  }

  private async reauthenticate(userId: string, currentPassword: string) {
    const state = await this.repository.findTotpState(userId);
    if (!state) throw new NotFoundException("Usuário não encontrado.");
    if (!state.passwordHash) {
      throw new BadRequestException("Este usuário não tem senha local; o acesso é só via SSO.");
    }
    const matches = await bcrypt.compare(currentPassword, state.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Senha atual incorreta.");
    }
    return state;
  }
}
