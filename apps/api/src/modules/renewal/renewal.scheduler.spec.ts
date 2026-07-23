import { Test } from "@nestjs/testing";
import { RenewalScheduler } from "./renewal.scheduler";
import { RenewalRepository } from "./renewal.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogService } from "../audit/audit-log.service";

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    tenantId: "tenant-1",
    name: "Sistema X",
    vendor: "Fornecedor X",
    nextReviewDate: daysFromNow(-31), // gatilho natural já passou (vencimento também)
    tenant: {
      annualClosingWindowEnabled: false,
      annualClosingWindowStart: null,
      annualClosingWindowEnd: null,
    },
    assessment: {
      id: "assessment-1",
      requester: { id: "requester-1", isActive: true },
    },
    ...overrides,
  };
}

function makeLapsedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    tenantId: "tenant-1",
    name: "Sistema X",
    vendor: "Fornecedor X",
    status: "PENDING_REVIEW",
    managerId: "manager-1",
    technicalResponsibleId: "tech-1",
    ...overrides,
  };
}

describe("RenewalScheduler", () => {
  let scheduler: RenewalScheduler;
  let repo: {
    findEligibleItems: jest.Mock;
    startRenewalCycle: jest.Mock;
    findAdministradorRoleId: jest.Mock;
    findLapsedItems: jest.Mock;
    markExpired: jest.Mock;
  };
  let notificationsService: { notify: jest.Mock; notifyRole: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findEligibleItems: jest.fn().mockResolvedValue([]),
      startRenewalCycle: jest.fn().mockResolvedValue(undefined),
      findAdministradorRoleId: jest.fn().mockResolvedValue({ id: "admin-role-1" }),
      findLapsedItems: jest.fn().mockResolvedValue([]),
      markExpired: jest.fn().mockResolvedValue(undefined),
    };
    notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyRole: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RenewalScheduler,
        { provide: RenewalRepository, useValue: repo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    scheduler = moduleRef.get(RenewalScheduler);
  });

  it("não faz nada quando não há itens elegíveis", async () => {
    await scheduler.checkRenewalTriggers();
    expect(repo.startRenewalCycle).not.toHaveBeenCalled();
    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it("não reabre quando o gatilho efetivo ainda não chegou", async () => {
    repo.findEligibleItems.mockResolvedValue([makeItem({ nextReviewDate: daysFromNow(5) })]);

    await scheduler.checkRenewalTriggers();

    expect(repo.startRenewalCycle).not.toHaveBeenCalled();
  });

  it("reabre a avaliação em PENDING_RENEWAL e notifica o solicitante ativo", async () => {
    repo.findEligibleItems.mockResolvedValue([makeItem()]);

    await scheduler.checkRenewalTriggers();

    expect(repo.startRenewalCycle).toHaveBeenCalledWith(
      "assessment-1",
      expect.objectContaining({ renewalDueAt: expect.any(Date), renewalCycleStartedAt: expect.any(Date) }),
    );
    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", userId: "requester-1", type: "RENEWAL_PENDING" }),
    );
    expect(notificationsService.notifyRole).not.toHaveBeenCalled();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", action: "REOPEN", entityType: "Assessment", entityId: "assessment-1" }),
    );
  });

  it("solicitante inativo: notifica o papel Administrador em vez do solicitante", async () => {
    repo.findEligibleItems.mockResolvedValue([
      makeItem({ assessment: { id: "assessment-1", requester: { id: "requester-1", isActive: false } } }),
    ]);

    await scheduler.checkRenewalTriggers();

    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(repo.findAdministradorRoleId).toHaveBeenCalledWith("tenant-1");
    expect(notificationsService.notifyRole).toHaveBeenCalledWith(
      "tenant-1",
      "admin-role-1",
      expect.objectContaining({ type: "RENEWAL_PENDING" }),
    );
  });

  it("solicitante inativo e nenhum papel Administrador encontrado: não quebra, não notifica ninguém", async () => {
    repo.findAdministradorRoleId.mockResolvedValue(null);
    repo.findEligibleItems.mockResolvedValue([
      makeItem({ assessment: { id: "assessment-1", requester: { id: "requester-1", isActive: false } } }),
    ]);

    await expect(scheduler.checkRenewalTriggers()).resolves.not.toThrow();
    expect(notificationsService.notify).not.toHaveBeenCalled();
    expect(notificationsService.notifyRole).not.toHaveBeenCalled();
    expect(repo.startRenewalCycle).toHaveBeenCalled();
  });

  it("janela de fechamento habilitada antecipa o gatilho mesmo antes da data natural", async () => {
    // nextReviewDate só daqui a 10 dias (gatilho natural no futuro), mas cai
    // dentro de uma janela de fechamento que já abriu hoje.
    const start = daysFromNow(-2);
    const end = daysFromNow(20);
    const mmdd = (date: Date) => `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    repo.findEligibleItems.mockResolvedValue([
      makeItem({
        nextReviewDate: daysFromNow(10),
        tenant: {
          annualClosingWindowEnabled: true,
          annualClosingWindowStart: mmdd(start),
          annualClosingWindowEnd: mmdd(end),
        },
      }),
    ]);

    await scheduler.checkRenewalTriggers();

    expect(repo.startRenewalCycle).toHaveBeenCalled();
  });

  describe("checkLapsedRenewals", () => {
    it("não faz nada quando não há itens com prazo vencido", async () => {
      await scheduler.checkLapsedRenewals();
      expect(repo.markExpired).not.toHaveBeenCalled();
      expect(notificationsService.notify).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("marca o item EXPIRED e notifica gestor, responsável técnico e o papel Administrador", async () => {
      repo.findLapsedItems.mockResolvedValue([makeLapsedItem()]);

      await scheduler.checkLapsedRenewals();

      expect(repo.markExpired).toHaveBeenCalledWith("item-1");
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "manager-1", type: "RENEWAL_OVERDUE" }),
      );
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "tech-1", type: "RENEWAL_OVERDUE" }),
      );
      expect(notificationsService.notifyRole).toHaveBeenCalledWith(
        "tenant-1",
        "admin-role-1",
        expect.objectContaining({ type: "RENEWAL_OVERDUE" }),
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-1", action: "UPDATE", entityType: "SoftwareInventoryItem", entityId: "item-1" }),
      );
    });

    it("notifica só uma vez quando gestor e responsável técnico são a mesma pessoa", async () => {
      repo.findLapsedItems.mockResolvedValue([
        makeLapsedItem({ managerId: "same-user", technicalResponsibleId: "same-user" }),
      ]);

      await scheduler.checkLapsedRenewals();

      expect(notificationsService.notify).toHaveBeenCalledTimes(1);
    });

    it("nenhum papel Administrador encontrado: ainda marca EXPIRED e notifica gestor/responsável, sem quebrar", async () => {
      repo.findAdministradorRoleId.mockResolvedValue(null);
      repo.findLapsedItems.mockResolvedValue([makeLapsedItem()]);

      await expect(scheduler.checkLapsedRenewals()).resolves.not.toThrow();
      expect(repo.markExpired).toHaveBeenCalledWith("item-1");
      expect(notificationsService.notifyRole).not.toHaveBeenCalled();
    });
  });
});
