import { Test } from "@nestjs/testing";
import { VendorReassessmentScheduler } from "./vendor-reassessment.scheduler";
import { VendorsRepository } from "./vendors.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogService } from "../audit/audit-log.service";

function makeVendor(overrides: Record<string, unknown> = {}) {
  return {
    id: "vendor-1",
    tenantId: "tenant-1",
    name: "Fornecedor X",
    currentTier: 3,
    currentTierLabel: "Risco elevado",
    nextReviewDueAt: new Date("2026-07-01"),
    assessments: [{ performedBy: { id: "performer-1", isActive: true } }],
    ...overrides,
  };
}

describe("VendorReassessmentScheduler", () => {
  let scheduler: VendorReassessmentScheduler;
  let repo: {
    findDueForReassessment: jest.Mock;
    markReassessmentNotified: jest.Mock;
    findAdministradorRoleId: jest.Mock;
  };
  let notificationsService: { notify: jest.Mock; notifyRole: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findDueForReassessment: jest.fn().mockResolvedValue([]),
      markReassessmentNotified: jest.fn().mockResolvedValue(undefined),
      findAdministradorRoleId: jest.fn().mockResolvedValue({ id: "admin-role-1" }),
    };
    notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyRole: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VendorReassessmentScheduler,
        { provide: VendorsRepository, useValue: repo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    scheduler = moduleRef.get(VendorReassessmentScheduler);
  });

  it("não faz nada quando não há fornecedores com reavaliação vencida", async () => {
    await scheduler.checkReassessmentsDue();
    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(notificationsService.notifyRole).not.toHaveBeenCalled();
    expect(repo.markReassessmentNotified).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it("notifica o responsável pela última avaliação quando ainda está ativo", async () => {
    repo.findDueForReassessment.mockResolvedValue([makeVendor()]);

    await scheduler.checkReassessmentsDue();

    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "performer-1",
        type: "VENDOR_REASSESSMENT_DUE",
        relatedEntityType: "Vendor",
        relatedEntityId: "vendor-1",
      }),
    );
    expect(notificationsService.notifyRole).not.toHaveBeenCalled();
    expect(repo.markReassessmentNotified).toHaveBeenCalledWith("vendor-1", expect.any(Date));
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        action: "UPDATE",
        entityType: "Vendor",
        entityId: "vendor-1",
      }),
    );
  });

  it("responsável inativo: notifica o papel Administrador em vez do responsável", async () => {
    repo.findDueForReassessment.mockResolvedValue([
      makeVendor({ assessments: [{ performedBy: { id: "performer-1", isActive: false } }] }),
    ]);

    await scheduler.checkReassessmentsDue();

    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(repo.findAdministradorRoleId).toHaveBeenCalledWith("tenant-1");
    expect(notificationsService.notifyRole).toHaveBeenCalledWith(
      "tenant-1",
      "admin-role-1",
      expect.objectContaining({ type: "VENDOR_REASSESSMENT_DUE" }),
    );
    expect(repo.markReassessmentNotified).toHaveBeenCalledWith("vendor-1", expect.any(Date));
  });

  it("nunca houve avaliação concluída (assessments vazio): trata como sem responsável ativo", async () => {
    repo.findDueForReassessment.mockResolvedValue([makeVendor({ assessments: [] })]);

    await scheduler.checkReassessmentsDue();

    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(notificationsService.notifyRole).toHaveBeenCalledWith(
      "tenant-1",
      "admin-role-1",
      expect.objectContaining({ type: "VENDOR_REASSESSMENT_DUE" }),
    );
  });

  it("responsável inativo e nenhum papel Administrador encontrado: não quebra, ainda marca notificado", async () => {
    repo.findAdministradorRoleId.mockResolvedValue(null);
    repo.findDueForReassessment.mockResolvedValue([
      makeVendor({ assessments: [{ performedBy: { id: "performer-1", isActive: false } }] }),
    ]);

    await expect(scheduler.checkReassessmentsDue()).resolves.not.toThrow();
    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(notificationsService.notifyRole).not.toHaveBeenCalled();
    expect(repo.markReassessmentNotified).toHaveBeenCalledWith("vendor-1", expect.any(Date));
  });

  it("processa múltiplos fornecedores vencidos numa mesma execução", async () => {
    repo.findDueForReassessment.mockResolvedValue([
      makeVendor({ id: "vendor-1" }),
      makeVendor({ id: "vendor-2", name: "Fornecedor Y" }),
    ]);

    await scheduler.checkReassessmentsDue();

    expect(notificationsService.notify).toHaveBeenCalledTimes(2);
    expect(repo.markReassessmentNotified).toHaveBeenCalledWith("vendor-1", expect.any(Date));
    expect(repo.markReassessmentNotified).toHaveBeenCalledWith("vendor-2", expect.any(Date));
  });
});
