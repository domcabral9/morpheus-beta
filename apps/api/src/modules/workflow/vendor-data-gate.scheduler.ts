import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { WorkflowRepository } from "./workflow.repository";
import { isVendorComplete } from "../vendors/vendor-completeness.util";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogService } from "../audit/audit-log.service";

/**
 * Job diário de aviso de fornecedor com cadastro incompleto (achado
 * 2026-08-19: o gate de aprovação em `WorkflowService.decideStep` bloqueia
 * silenciosamente até alguém tentar decidir - esta varredura avisa
 * proativamente quem precisa agir, mesmo que ninguém tenha tentado aprovar
 * ainda). Ao contrário de `RenewalScheduler`/`VendorReassessmentScheduler`
 * (que travam com um timestamp de idempotência até o estado mudar), esta
 * roda todo dia sem trava - decisão do usuário: "uma vez por dia enquanto
 * persistir", não uma notificação única.
 */
@Injectable()
export class VendorDataGateScheduler {
  private readonly logger = new Logger(VendorDataGateScheduler.name);

  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Cron("45 7 * * *")
  async checkIncompleteVendorData(): Promise<void> {
    const steps = await this.workflowRepository.findInProgressStepsWithVendorLinked();
    let notified = 0;

    for (const step of steps) {
      const assessment = step.assessmentWorkflowInstance.assessment;
      if (!assessment.linkedVendor || isVendorComplete(assessment.linkedVendor)) continue;

      await this.notificationsService.notify({
        tenantId: assessment.tenantId,
        userId: assessment.requesterId,
        type: "VENDOR_DATA_INCOMPLETE",
        data: { softwareName: assessment.softwareName, vendorName: assessment.linkedVendor.name },
        relatedEntityType: "Assessment",
        relatedEntityId: assessment.id,
      });

      await this.notificationsService.notifyRole(
        assessment.tenantId,
        step.workflowStep.responsibleRoleId,
        {
          type: "VENDOR_DATA_INCOMPLETE_BLOCKS_APPROVAL",
          data: { softwareName: assessment.softwareName, vendorName: assessment.linkedVendor.name },
          relatedEntityType: "Assessment",
          relatedEntityId: assessment.id,
        },
      );

      await this.auditLogService.record({
        tenantId: assessment.tenantId,
        action: "UPDATE",
        entityType: "Assessment",
        entityId: assessment.id,
        metadata: {
          reason: "vendor_data_incomplete_notified",
          vendorId: assessment.linkedVendor.id,
        },
      });

      notified += 1;
    }

    if (notified > 0) {
      this.logger.log(`Fornecedor com cadastro incompleto: ${notified} aviso(s) disparado(s).`);
    }
  }
}
