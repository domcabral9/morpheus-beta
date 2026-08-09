import { Injectable } from "@nestjs/common";
import { PlatformIntegrationsPolicy } from "@morpheus/database";
import { AuditLogService } from "../audit/audit-log.service";
import { CryptoService } from "../../common/services/crypto/crypto.service";
import {
  IntegrationsPolicyRepository,
  IntegrationsPolicyUpdateData,
} from "./integrations-policy.repository";
import { UpdateIntegrationsPolicyDto } from "./dto/update-integrations-policy.dto";

/**
 * Forma pública da policy - nunca inclui `virusTotalApiKeyEncrypted`, cru ou
 * decriptografado. `hasVirusTotalApiKey` é o único jeito de saber se uma
 * chave está configurada sem expor o valor.
 */
export interface IntegrationsPolicyView {
  virusTotalEnabled: boolean;
  virusTotalDailyBudget: number;
  hasVirusTotalApiKey: boolean;
  endoflifeEnabled: boolean;
  updatedByUserId: string | null;
  updatedAt: Date;
}

@Injectable()
export class IntegrationsPolicyService {
  constructor(
    private readonly repository: IntegrationsPolicyRepository,
    private readonly cryptoService: CryptoService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getPolicy(): Promise<IntegrationsPolicyView> {
    const row = await this.repository.getOrCreate();
    return this.toView(row);
  }

  async updatePolicy(
    dto: UpdateIntegrationsPolicyDto,
    actingUserId: string,
  ): Promise<IntegrationsPolicyView> {
    const data: IntegrationsPolicyUpdateData = {};
    if (dto.virusTotalApiKey !== undefined) {
      data.virusTotalApiKeyEncrypted = this.cryptoService.encrypt(dto.virusTotalApiKey);
    }
    if (dto.virusTotalEnabled !== undefined) data.virusTotalEnabled = dto.virusTotalEnabled;
    if (dto.virusTotalDailyBudget !== undefined) {
      data.virusTotalDailyBudget = dto.virusTotalDailyBudget;
    }
    if (dto.endoflifeEnabled !== undefined) data.endoflifeEnabled = dto.endoflifeEnabled;

    const updated = await this.repository.update(data, actingUserId);

    // Cross-tenant (tenantId null), mesmo padrão das outras policies de
    // plataforma - metadata NUNCA carrega a chave, só o fato de ter mudado.
    await this.auditLogService.record({
      tenantId: null,
      userId: actingUserId,
      action: "UPDATE",
      entityType: "PlatformIntegrationsPolicy",
      entityId: updated.id,
      metadata: {
        virusTotalEnabled: updated.virusTotalEnabled,
        virusTotalDailyBudget: updated.virusTotalDailyBudget,
        endoflifeEnabled: updated.endoflifeEnabled,
        keyChanged: dto.virusTotalApiKey !== undefined,
      },
    });

    return this.toView(updated);
  }

  /** Acesso interno à chave real, decriptografada - nunca exposto via
   * controller. Só chamado por serviços que efetivamente fazem a chamada
   * externa (`VirusTotalClient`, via `ReputationService`). */
  async getDecryptedVirusTotalApiKey(): Promise<string | null> {
    const row = await this.repository.getOrCreate();
    if (!row.virusTotalApiKeyEncrypted) return null;
    return this.cryptoService.decrypt(row.virusTotalApiKeyEncrypted);
  }

  private toView(row: PlatformIntegrationsPolicy): IntegrationsPolicyView {
    return {
      virusTotalEnabled: row.virusTotalEnabled,
      virusTotalDailyBudget: row.virusTotalDailyBudget,
      hasVirusTotalApiKey: Boolean(row.virusTotalApiKeyEncrypted),
      endoflifeEnabled: row.endoflifeEnabled,
      updatedByUserId: row.updatedByUserId,
      updatedAt: row.updatedAt,
    };
  }
}
