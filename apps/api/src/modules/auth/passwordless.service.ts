import { Injectable, UnauthorizedException } from "@nestjs/common";
import { OneTimeCodePurpose } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PasswordlessPolicyService } from "../platform-policy/passwordless-policy.service";
import { UsersService } from "../users/users.service";
import type { UserWithPermissions } from "../users/users.repository";
import { OneTimeCodeRepository } from "./one-time-code.repository";
import {
  generateSixDigitCode,
  hashOneTimeCode,
  ONE_TIME_CODE_MAX_ATTEMPTS,
  ONE_TIME_CODE_TTL_MS,
} from "./one-time-code.util";

@Injectable()
export class PasswordlessService {
  constructor(
    private readonly oneTimeCodeRepository: OneTimeCodeRepository,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly passwordlessPolicyService: PasswordlessPolicyService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Nunca lança e nunca ramifica o retorno observável - tenant/e-mail
   * inexistente, usuário inativo, e-mail não verificado ou toggle desligado
   * são todos tratados como "não gera nem envia código", em silêncio (ver
   * plano: contrato de anti-enumeração é requisito de design). O controller
   * sempre responde 200/204 independente do que aconteceu aqui dentro.
   */
  async requestLogin(tenantSlug: string, rawEmail: string): Promise<void> {
    const policy = await this.passwordlessPolicyService.getPolicy();
    if (!policy.enabled) return;

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return;

    const user = await this.usersService.findByEmail(tenant.id, rawEmail);
    if (!user || !user.isActive || !user.emailVerified) return;

    const code = generateSixDigitCode();
    await this.oneTimeCodeRepository.createCode(
      user.id,
      OneTimeCodePurpose.PASSWORDLESS_LOGIN,
      hashOneTimeCode(code),
      new Date(Date.now() + ONE_TIME_CODE_TTL_MS),
    );
    await this.notificationsService.sendRawEmail({
      to: user.email,
      subject: "Seu código de login - Morpheus",
      html: `<p>Seu código de login é <strong>${code}</strong>. Ele expira em 10 minutos.</p>`,
    });
  }

  /**
   * Mensagem de erro idêntica em todo caso de falha (tenant/e-mail
   * inexistente, código ausente/expirado/errado/estourado) - mesmo raciocínio
   * de anti-enumeração do `requestLogin`, agora do lado da confirmação.
   * Sucesso devolve o `UserWithPermissions` completo pra
   * `AuthController.verifyPasswordlessLogin` chamar `authService.login()`
   * diretamente - pulando por completo o branch de `totpEnabled` (decisão de
   * design confirmada com o usuário, ver plano/CHANGELOG).
   */
  async verifyLogin(
    tenantSlug: string,
    rawEmail: string,
    rawCode: string,
  ): Promise<UserWithPermissions> {
    const invalid = () => new UnauthorizedException("Código inválido.");

    // Reconfirmado aqui, não só em requestLogin - achado da revisão de
    // segurança da Fase 6: sem isto, desligar o toggle não interrompe login
    // com um código já emitido e ainda dentro da janela de 10min (o toggle
    // deixava de ser um kill-switch de verdade).
    const policy = await this.passwordlessPolicyService.getPolicy();
    if (!policy.enabled) throw invalid();

    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw invalid();

    const user = await this.usersService.findByEmail(tenant.id, rawEmail);
    if (!user || !user.isActive || !user.emailVerified) throw invalid();

    const active = await this.oneTimeCodeRepository.findActiveCode(
      user.id,
      OneTimeCodePurpose.PASSWORDLESS_LOGIN,
    );
    if (!active) throw invalid();
    if (active.attempts >= ONE_TIME_CODE_MAX_ATTEMPTS) {
      await this.oneTimeCodeRepository.markUsed(active.id);
      throw invalid();
    }
    if (active.codeHash !== hashOneTimeCode(rawCode)) {
      await this.oneTimeCodeRepository.incrementAttempts(active.id);
      throw invalid();
    }

    await this.oneTimeCodeRepository.markUsed(active.id);
    return user;
  }
}
