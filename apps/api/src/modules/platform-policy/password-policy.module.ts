import { Module } from "@nestjs/common";
import { PasswordPolicyController } from "./password-policy.controller";
import { PasswordPolicyRepository } from "./password-policy.repository";
import { PasswordPolicyService } from "./password-policy.service";

// PrismaService/AuditLogService são globais, não precisam entrar em imports.
@Module({
  controllers: [PasswordPolicyController],
  providers: [PasswordPolicyRepository, PasswordPolicyService],
  exports: [PasswordPolicyService],
})
export class PasswordPolicyModule {}
