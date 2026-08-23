import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AuditLogService } from "../audit/audit-log.service";
import { SampleDataRepository, SampleEntityType } from "./sample-data.repository";

const ENTITY_TYPE_TO_AUDIT_LABEL: Record<SampleEntityType, string> = {
  vendor: "Vendor",
  "inventory-item": "SoftwareInventoryItem",
  assessment: "Assessment",
};

@Injectable()
export class SampleDataService {
  constructor(
    private readonly repository: SampleDataRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(params: { tenantId?: string; page: number; pageSize: number }) {
    const allSamples = await this.repository.findAllSamples(params.tenantId);
    const total = allSamples.length;
    const start = (params.page - 1) * params.pageSize;
    const items = allSamples.slice(start, start + params.pageSize);
    return { items, total, page: params.page, pageSize: params.pageSize };
  }

  /** Reconfirma `isSampleData === true` direto no banco antes de apagar -
   * nunca confia em nada vindo do client, mesmo princípio de "reconta do
   * zero" já usado em `VendorsService.deleteVendor`/
   * `AssessmentsService.deleteAssessment`. Um ID de registro real (sem a
   * flag) sempre resulta em 404, mesmo que exista de verdade. */
  async remove(user: AuthenticatedUser, entityType: SampleEntityType, id: string): Promise<void> {
    switch (entityType) {
      case "vendor": {
        const sample = await this.repository.findSampleVendorById(id);
        if (!sample) throw new NotFoundException("Fornecedor de amostra não encontrado.");
        await this.repository.removeVendor(id);
        await this.recordDeletion(user, "vendor", id, sample.tenantId);
        return;
      }
      case "inventory-item": {
        const sample = await this.repository.findSampleInventoryItemById(id);
        if (!sample) throw new NotFoundException("Item de inventário de amostra não encontrado.");
        await this.repository.removeInventoryItem(id);
        await this.recordDeletion(user, "inventory-item", id, sample.tenantId);
        return;
      }
      case "assessment": {
        const sample = await this.repository.findSampleAssessmentById(id);
        if (!sample) throw new NotFoundException("Avaliação de amostra não encontrada.");
        await this.repository.removeAssessment(id);
        await this.recordDeletion(user, "assessment", id, sample.tenantId);
        return;
      }
      default:
        throw new BadRequestException("Tipo de entidade inválido.");
    }
  }

  private async recordDeletion(
    user: AuthenticatedUser,
    entityType: SampleEntityType,
    entityId: string,
    tenantId: string,
  ): Promise<void> {
    await this.auditLogService.record({
      tenantId,
      userId: user.id,
      action: "DELETE",
      entityType: ENTITY_TYPE_TO_AUDIT_LABEL[entityType],
      entityId,
      metadata: { isSampleData: true, deletedViaSampleDataTool: true },
    });
  }
}
