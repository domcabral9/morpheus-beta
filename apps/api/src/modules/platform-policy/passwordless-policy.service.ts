import { Injectable } from "@nestjs/common";
import { PlatformPasswordlessPolicy } from "@morpheus/database";
import { AuditLogService } from "../audit/audit-log.service";
import { PasswordlessPolicyRepository } from "./passwordless-policy.repository";

@Injectable()
export class PasswordlessPolicyService {
  constructor(
    private readonly repository: PasswordlessPolicyRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  getPolicy(): Promise<PlatformPasswordlessPolicy> {
    return this.repository.getOrCreate();
  }

  async updatePolicy(enabled: boolean, actingUserId: string): Promise<PlatformPasswordlessPolicy> {
    const updated = await this.repository.update(enabled, actingUserId);

    // Cross-tenant (tenantId null), mesmo padrão de TwoFactorPolicyService.
    await this.auditLogService.record({
      tenantId: null,
      userId: actingUserId,
      action: "UPDATE",
      entityType: "PlatformPasswordlessPolicy",
      entityId: updated.id,
      metadata: { enabled },
    });

    return updated;
  }
}
