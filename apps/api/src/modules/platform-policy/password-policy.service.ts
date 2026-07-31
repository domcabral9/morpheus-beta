import { BadRequestException, Injectable } from "@nestjs/common";
import { PlatformPasswordPolicy } from "@morpheus/database";
import { AuditLogService } from "../audit/audit-log.service";
import { PasswordPolicyRepository } from "./password-policy.repository";
import { UpdatePasswordPolicyDto } from "./dto/update-password-policy.dto";
import { validatePasswordAgainstPolicy } from "./password-policy.util";

@Injectable()
export class PasswordPolicyService {
  constructor(
    private readonly repository: PasswordPolicyRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  getPolicy(): Promise<PlatformPasswordPolicy> {
    return this.repository.getOrCreate();
  }

  async updatePolicy(
    dto: UpdatePasswordPolicyDto,
    actingUserId: string,
  ): Promise<PlatformPasswordPolicy> {
    const updated = await this.repository.update(dto, actingUserId);

    // Evento genuinamente cross-tenant (tenantId null) - não usa @Audit()
    // porque essa configuração não pertence a nenhum tenant específico.
    await this.auditLogService.record({
      tenantId: null,
      userId: actingUserId,
      action: "UPDATE",
      entityType: "PlatformPasswordPolicy",
      entityId: updated.id,
      metadata: { ...dto },
    });

    return updated;
  }

  /**
   * Seam único usado por todo lugar que define/troca uma senha - garante que
   * a política configurável vale de fato, não só existe numa tela.
   */
  async validate(password: string): Promise<void> {
    const policy = await this.getPolicy();
    const violations = validatePasswordAgainstPolicy(password, policy);
    if (violations.length > 0) {
      throw new BadRequestException(violations.join(" "));
    }
  }
}
