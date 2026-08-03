import { Module } from "@nestjs/common";
import { PasswordPolicyController } from "./password-policy.controller";
import { PasswordPolicyRepository } from "./password-policy.repository";
import { PasswordPolicyService } from "./password-policy.service";
import { TwoFactorPolicyController } from "./two-factor-policy.controller";
import { TwoFactorPolicyRepository } from "./two-factor-policy.repository";
import { TwoFactorPolicyService } from "./two-factor-policy.service";

// PrismaService/AuditLogService são globais, não precisam entrar em imports.
// Um módulo só para as duas políticas cross-tenant (senha + 2FA) - mesmo
// domínio ("configuração de plataforma"), não multiplica módulos pequenos.
@Module({
  controllers: [PasswordPolicyController, TwoFactorPolicyController],
  providers: [
    PasswordPolicyRepository,
    PasswordPolicyService,
    TwoFactorPolicyRepository,
    TwoFactorPolicyService,
  ],
  exports: [PasswordPolicyService, TwoFactorPolicyService],
})
export class PlatformPolicyModule {}
