import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SampleDataService } from "./sample-data.service";
import { SampleDataRepository } from "./sample-data.repository";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    homeTenantId: "tenant-1",
    email: "a@b.com",
    name: "A",
    permissions: ["platform:cross-tenant"],
    isSuperAdmin: true,
    ...overrides,
  };
}

describe("SampleDataService", () => {
  let service: SampleDataService;
  let repo: {
    findAllSamples: jest.Mock;
    findSampleVendorById: jest.Mock;
    findSampleInventoryItemById: jest.Mock;
    findSampleAssessmentById: jest.Mock;
    removeVendor: jest.Mock;
    removeInventoryItem: jest.Mock;
    removeAssessment: jest.Mock;
  };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findAllSamples: jest.fn().mockResolvedValue([]),
      findSampleVendorById: jest.fn(),
      findSampleInventoryItemById: jest.fn(),
      findSampleAssessmentById: jest.fn(),
      removeVendor: jest.fn().mockResolvedValue(undefined),
      removeInventoryItem: jest.fn().mockResolvedValue(undefined),
      removeAssessment: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SampleDataService,
        { provide: SampleDataRepository, useValue: repo },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(SampleDataService);
  });

  describe("list", () => {
    it("agrega os itens do repository e pagina em memória", async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        entityType: "vendor" as const,
        id: `v${i}`,
        name: `Vendor ${i}`,
        tenantId: "tenant-1",
        tenantName: "Demo",
        createdById: "user-1",
        createdByName: "A",
        createdAt: new Date(2026, 0, i + 1),
      }));
      repo.findAllSamples.mockResolvedValue(items);

      const result = await service.list({ page: 1, pageSize: 20 });

      expect(result.total).toBe(25);
      expect(result.items).toHaveLength(20);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it("repassa o filtro de tenantId pro repository", async () => {
      await service.list({ tenantId: "tenant-2", page: 1, pageSize: 20 });
      expect(repo.findAllSamples).toHaveBeenCalledWith("tenant-2");
    });
  });

  describe("remove", () => {
    it("lança NotFoundException para vendor sem isSampleData:true, mesmo com ID real", async () => {
      repo.findSampleVendorById.mockResolvedValue(null);
      await expect(service.remove(makeUser(), "vendor", "vendor-real")).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.removeVendor).not.toHaveBeenCalled();
    });

    it("apaga um vendor sample confirmado e audita", async () => {
      repo.findSampleVendorById.mockResolvedValue({ id: "vendor-1", tenantId: "tenant-1" });
      await service.remove(makeUser(), "vendor", "vendor-1");
      expect(repo.removeVendor).toHaveBeenCalledWith("vendor-1");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          action: "DELETE",
          entityType: "Vendor",
          entityId: "vendor-1",
          metadata: { isSampleData: true, deletedViaSampleDataTool: true },
        }),
      );
    });

    it("lança NotFoundException para item de inventário sem isSampleData:true", async () => {
      repo.findSampleInventoryItemById.mockResolvedValue(null);
      await expect(service.remove(makeUser(), "inventory-item", "item-real")).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.removeInventoryItem).not.toHaveBeenCalled();
    });

    it("apaga um item de inventário sample confirmado", async () => {
      repo.findSampleInventoryItemById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1" });
      await service.remove(makeUser(), "inventory-item", "item-1");
      expect(repo.removeInventoryItem).toHaveBeenCalledWith("item-1");
    });

    it("lança NotFoundException para avaliação sem isSampleData:true", async () => {
      repo.findSampleAssessmentById.mockResolvedValue(null);
      await expect(service.remove(makeUser(), "assessment", "assessment-real")).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.removeAssessment).not.toHaveBeenCalled();
    });

    it("apaga uma avaliação sample confirmada", async () => {
      repo.findSampleAssessmentById.mockResolvedValue({ id: "a1", tenantId: "tenant-1" });
      await service.remove(makeUser(), "assessment", "a1");
      expect(repo.removeAssessment).toHaveBeenCalledWith("a1");
    });

    it("lança BadRequestException para um entityType desconhecido", async () => {
      await expect(service.remove(makeUser(), "unknown-type" as never, "some-id")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
