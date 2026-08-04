import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { OneTimeCodePurpose } from "@morpheus/database";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { UsersService } from "../users/users.service";
import { OneTimeCodeRepository } from "./one-time-code.repository";
import {
  generateSixDigitCode,
  hashOneTimeCode,
  ONE_TIME_CODE_MAX_ATTEMPTS,
  ONE_TIME_CODE_TTL_MS,
} from "./one-time-code.util";

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly oneTimeCodeRepository: OneTimeCodeRepository,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Autoatendimento (POST /auth/email/verify/request) — sempre gera e envia
   * um código novo, mesmo que já exista um pendente (o findActiveCode da
   * Fase de confirmação sempre pega o mais recente, então pedidos repetidos
   * são seguros, não acumulam confusão sobre "qual código vale"). */
  async requestVerification(actor: AuthenticatedUser): Promise<void> {
    const code = generateSixDigitCode();
    await this.oneTimeCodeRepository.createCode(
      actor.id,
      OneTimeCodePurpose.EMAIL_VERIFICATION,
      hashOneTimeCode(code),
      new Date(Date.now() + ONE_TIME_CODE_TTL_MS),
    );
    await this.notificationsService.sendRawEmail({
      to: actor.email,
      subject: "Confirme seu e-mail — Morpheus",
      html: `<p>Seu código de verificação é <strong>${code}</strong>. Ele expira em 10 minutos.</p>`,
    });
  }

  async confirmVerification(actor: AuthenticatedUser, rawCode: string): Promise<void> {
    const active = await this.oneTimeCodeRepository.findActiveCode(
      actor.id,
      OneTimeCodePurpose.EMAIL_VERIFICATION,
    );
    if (!active) {
      throw new BadRequestException("Nenhum código de verificação pendente. Peça um novo.");
    }
    if (active.attempts >= ONE_TIME_CODE_MAX_ATTEMPTS) {
      await this.oneTimeCodeRepository.markUsed(active.id);
      throw new UnauthorizedException("Código expirado por excesso de tentativas. Peça um novo.");
    }
    if (active.codeHash !== hashOneTimeCode(rawCode)) {
      await this.oneTimeCodeRepository.incrementAttempts(active.id);
      throw new UnauthorizedException("Código inválido.");
    }

    await this.oneTimeCodeRepository.markUsed(active.id);
    await this.usersService.markEmailVerified(actor.id);

    await this.auditLogService.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: actor.id,
      metadata: { field: "emailVerified", initiatedBy: "self" },
    });
  }
}
