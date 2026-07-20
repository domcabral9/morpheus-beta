import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { InventoryReviewScheduler } from "./inventory-review.scheduler";
import { InventoryRepository } from "./inventory.repository";
import { NotificationsService } from "../notifications/notifications.service";

describe("InventoryReviewScheduler", () => {
  let scheduler: InventoryReviewScheduler;
  let repo: { findDueForReview: jest.Mock; update: jest.Mock };
  let notificationsService: { notify: jest.Mock };

  beforeEach(async () => {
    repo = { findDueForReview: jest.fn().mockResolvedValue([]), update: jest.fn() };
    notificationsService = { notify: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InventoryReviewScheduler,
        { provide: InventoryRepository, useValue: repo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ConfigService, useValue: { get: () => 30 } },
      ],
    }).compile();

    scheduler = moduleRef.get(InventoryReviewScheduler);
  });

  it("não faz nada quando não há itens vencendo", async () => {
    await scheduler.checkExpiringReviews();
    expect(repo.update).not.toHaveBeenCalled();
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it("marca o item como PENDING_REVIEW e notifica gestor e responsável técnico", async () => {
    repo.findDueForReview.mockResolvedValue([
      {
        id: "item-1",
        tenantId: "tenant-1",
        name: "Sistema X",
        vendor: "Fornecedor X",
        nextReviewDate: new Date("2026-08-01"),
        managerId: "manager-1",
        technicalResponsibleId: "tech-1",
      },
    ]);

    await scheduler.checkExpiringReviews();

    expect(repo.update).toHaveBeenCalledWith("item-1", { status: "PENDING_REVIEW" });
    expect(notificationsService.notify).toHaveBeenCalledTimes(2);
    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "manager-1", type: "HOMOLOGATION_EXPIRING" }),
    );
    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "tech-1", type: "HOMOLOGATION_EXPIRING" }),
    );
  });

  it("notifica só uma vez quando gestor e responsável técnico são a mesma pessoa", async () => {
    repo.findDueForReview.mockResolvedValue([
      {
        id: "item-1",
        tenantId: "tenant-1",
        name: "Sistema X",
        vendor: "Fornecedor X",
        nextReviewDate: new Date("2026-08-01"),
        managerId: "same-user",
        technicalResponsibleId: "same-user",
      },
    ]);

    await scheduler.checkExpiringReviews();

    expect(notificationsService.notify).toHaveBeenCalledTimes(1);
  });
});
