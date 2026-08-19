import { Test } from "@nestjs/testing";
import { VendorDataGateScheduler } from "./vendor-data-gate.scheduler";
import { WorkflowRepository } from "./workflow.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogService } from "../audit/audit-log.service";

function makeStep(vendor: Record<string, unknown> | null, overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    workflowStep: { responsibleRoleId: "role-gestor" },
    assessmentWorkflowInstance: {
      assessment: {
        id: "assessment-1",
        tenantId: "tenant-1",
        requesterId: "requester-1",
        softwareName: "Sistema X",
        vendorId: vendor ? "vendor-1" : null,
        linkedVendor: vendor,
      },
    },
    ...overrides,
  };
}

const INCOMPLETE_VENDOR = {
  id: "vendor-1",
  name: "Fornecedor Teste",
  legalName: null,
  taxId: null,
  businessCriticality: null,
};

const COMPLETE_VENDOR = {
  id: "vendor-1",
  name: "Fornecedor Teste",
  legalName: "Fornecedor Teste Ltda",
  taxId: "12.345.678/0001-90",
  businessCriticality: "MEDIUM",
};

describe("VendorDataGateScheduler", () => {
  let scheduler: VendorDataGateScheduler;
  let repo: { findInProgressStepsWithVendorLinked: jest.Mock };
  let notificationsService: { notify: jest.Mock; notifyRole: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = { findInProgressStepsWithVendorLinked: jest.fn().mockResolvedValue([]) };
    notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyRole: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VendorDataGateScheduler,
        { provide: WorkflowRepository, useValue: repo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    scheduler = moduleRef.get(VendorDataGateScheduler);
  });

  it("não faz nada quando não há etapas em andamento com fornecedor vinculado", async () => {
    await scheduler.checkIncompleteVendorData();
    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(notificationsService.notifyRole).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it("notifica solicitante + papel responsável quando o fornecedor está incompleto", async () => {
    repo.findInProgressStepsWithVendorLinked.mockResolvedValue([makeStep(INCOMPLETE_VENDOR)]);

    await scheduler.checkIncompleteVendorData();

    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "requester-1",
        type: "VENDOR_DATA_INCOMPLETE",
        relatedEntityType: "Assessment",
        relatedEntityId: "assessment-1",
      }),
    );
    expect(notificationsService.notifyRole).toHaveBeenCalledWith(
      "tenant-1",
      "role-gestor",
      expect.objectContaining({ type: "VENDOR_DATA_INCOMPLETE_BLOCKS_APPROVAL" }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        entityType: "Assessment",
        entityId: "assessment-1",
      }),
    );
  });

  it("ignora etapas cujo fornecedor já está completo", async () => {
    repo.findInProgressStepsWithVendorLinked.mockResolvedValue([makeStep(COMPLETE_VENDOR)]);

    await scheduler.checkIncompleteVendorData();

    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(notificationsService.notifyRole).not.toHaveBeenCalled();
  });

  it("ignora etapas sem fornecedor vinculado", async () => {
    repo.findInProgressStepsWithVendorLinked.mockResolvedValue([makeStep(null)]);

    await scheduler.checkIncompleteVendorData();

    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it("processa múltiplas etapas numa mesma execução, sem trava de idempotência (notifica todo dia enquanto persistir)", async () => {
    repo.findInProgressStepsWithVendorLinked.mockResolvedValue([
      makeStep(INCOMPLETE_VENDOR, { id: "exec-1" }),
      makeStep(INCOMPLETE_VENDOR, {
        id: "exec-2",
        assessmentWorkflowInstance: {
          assessment: {
            id: "assessment-2",
            tenantId: "tenant-1",
            requesterId: "requester-2",
            softwareName: "Sistema Y",
            vendorId: "vendor-1",
            linkedVendor: INCOMPLETE_VENDOR,
          },
        },
      }),
    ]);

    await scheduler.checkIncompleteVendorData();

    expect(notificationsService.notify).toHaveBeenCalledTimes(2);
  });
});
