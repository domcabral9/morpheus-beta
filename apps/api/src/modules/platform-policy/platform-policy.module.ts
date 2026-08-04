import { Module } from "@nestjs/common";
import { PasswordPolicyController } from "./password-policy.controller";
import { PasswordPolicyRepository } from "./password-policy.repository";
import { PasswordPolicyService } from "./password-policy.service";
import { TwoFactorPolicyController } from "./two-factor-policy.controller";
import { TwoFactorPolicyRepository } from "./two-factor-policy.repository";
import { TwoFactorPolicyService } from "./two-factor-policy.service";
import { PasswordlessPolicyController } from "./passwordless-policy.controller";
import { PasswordlessPolicyRepository } from "./passwordless-policy.repository";
import { PasswordlessPolicyService } from "./passwordless-policy.service";

// PrismaService/AuditLogService são globais, não precisam entrar em imports.
// Um módulo só para as três políticas cross-tenant (senha + 2FA + passwordless)
// - mesmo domínio ("configuração de plataforma"), não multiplica módulos pequenos.
@Module({
  controllers: [PasswordPolicyController, TwoFactorPolicyController, PasswordlessPolicyController],
  providers: [
    PasswordPolicyRepository,
    PasswordPolicyService,
    TwoFactorPolicyRepository,
    TwoFactorPolicyService,
    PasswordlessPolicyRepository,
    PasswordlessPolicyService,
  ],
  exports: [PasswordPolicyService, TwoFactorPolicyService, PasswordlessPolicyService],
})
export class PlatformPolicyModule {}
