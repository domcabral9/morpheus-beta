import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AuditLogService } from "../../audit/audit-log.service";
import { AttachmentsRepository, AttachmentDetail } from "../../attachments/attachments.repository";
import { STORAGE_ADAPTER, StorageAdapter } from "../../storage/storage.interface";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";
import { InventoryRepository, InventoryItemDetail } from "../inventory.repository";
import { VirusTotalClient } from "./virustotal.client";
import { ReputationBudgetRepository } from "./reputation-budget.repository";

export class ReputationBudgetExhaustedException extends BadRequestException {
  constructor() {
    super("Cota diária de checagens de reputação atingida.");
  }
}

function pickLatestAttachment(attachments: AttachmentDetail[]): AttachmentDetail | null {
  if (attachments.length === 0) return null;
  return attachments.reduce((latest, current) =>
    current.uploadedAt > latest.uploadedAt ? current : latest,
  );
}

/**
 * Checagem de reputação de ameaça (VirusTotal) - precedência de artefato
 * (decisão do plano): hash de anexo > URL, nunca os dois na mesma checagem
 * (mais resistente a adulteração, e evita gastar 2 unidades de cota por
 * clique em vez de 1). `actingUserId` é `null` quando chamado pela varredura
 * noturna (ReputationSweepScheduler) - mesmo padrão de auditoria "sem
 * usuário" já usado por RenewalScheduler/VendorReassessmentScheduler.
 */
@Injectable()
export class ReputationService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly attachmentsRepository: AttachmentsRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    private readonly virusTotalClient: VirusTotalClient,
    private readonly budgetRepository: ReputationBudgetRepository,
    private readonly integrationsPolicyService: IntegrationsPolicyService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async performCheck(
    item: InventoryItemDetail,
    actingUserId: string | null,
  ): Promise<InventoryItemDetail> {
    const attachments = await this.attachmentsRepository.findMany({
      tenantId: item.tenantId,
      inventoryItemId: item.id,
    });
    const latestAttachment = pickLatestAttachment(attachments);

    if (!latestAttachment && !item.url) {
      throw new BadRequestException("Item sem artefato (URL ou anexo) para checar reputação.");
    }

    const policy = await this.integrationsPolicyService.getPolicy();
    if (!policy.virusTotalEnabled) {
      throw new BadRequestException("Integração com VirusTotal está desabilitada.");
    }
    const consumed = await this.budgetRepository.tryConsume(policy.virusTotalDailyBudget);
    if (!consumed) {
      throw new ReputationBudgetExhaustedException();
    }
    const apiKey = await this.integrationsPolicyService.getDecryptedVirusTotalApiKey();
    if (!apiKey) {
      throw new BadRequestException("Nenhuma chave de API do VirusTotal configurada.");
    }

    let source: "URL" | "ATTACHMENT_HASH";
    let verdict: "CLEAN" | "SUSPICIOUS" | null;
    let checkedAttachmentId: string | null = null;

    if (latestAttachment) {
      source = "ATTACHMENT_HASH";
      const buffer = await this.storage.read(latestAttachment.storageKey);
      const hash = createHash("sha256").update(buffer).digest("hex");
      verdict = await this.virusTotalClient.checkHash(hash, apiKey);
      checkedAttachmentId = latestAttachment.id;
    } else {
      source = "URL";
      verdict = await this.virusTotalClient.checkUrl(item.url!, apiKey);
    }

    const updated = await this.repository.update(item.id, {
      reputationLastCheckedAt: new Date(),
      reputationVerdict: verdict,
      reputationCheckedSource: source,
      reputationCheckedAttachmentId: checkedAttachmentId,
    });

    // Metadata nunca inclui a URL/bytes do artefato em si - só a fonte e o
    // veredito (não enviar mais contexto do que o necessário pro terceiro
    // já é suficiente cuidado; não precisa duplicar isso no audit log).
    await this.auditLogService.record({
      tenantId: item.tenantId,
      userId: actingUserId,
      action: "UPDATE",
      entityType: "SoftwareInventoryItem",
      entityId: item.id,
      metadata: { field: "reputation", source, verdict },
    });

    return updated;
  }
}
