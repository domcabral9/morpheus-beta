import { Injectable } from "@nestjs/common";
import { PlatformTwoFactorPolicy } from "@morpheus/database";
import { AuditLogService } from "../audit/audit-log.service";
import { TwoFactorPolicyRepository } from "./two-factor-policy.repository";

@Injectable()
export class TwoFactorPolicyService {
  constructor(
    private readonly repository: TwoFactorPolicyRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  getPolicy(): Promise<PlatformTwoFactorPolicy> {
    return this.repository.getOrCreate();
  }

  async updatePolicy(enforced: boolean, actingUserId: string): Promise<PlatformTwoFactorPolicy> {
    const updated = await this.repository.update(enforced, actingUserId);

    // Cross-tenant (tenantId null), mesmo padrão de PasswordPolicyService.
    await this.auditLogService.record({
      tenantId: null,
      userId: actingUserId,
      action: "UPDATE",
      entityType: "PlatformTwoFactorPolicy",
      entityId: updated.id,
      metadata: { enforced },
    });

    return updated;
  }
}
