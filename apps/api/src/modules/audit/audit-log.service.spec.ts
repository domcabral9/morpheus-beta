import { Test } from "@nestjs/testing";
import { AuditLogService } from "./audit-log.service";
import { AuditLogRepository } from "./audit-log.repository";
import { SIEM_ADAPTER } from "../integrations/siem/siem.interface";

describe("AuditLogService", () => {
  let service: AuditLogService;
  let repository: { create: jest.Mock; findMany: jest.Mock };
  let siemAdapter: { send: jest.Mock };

  beforeEach(async () => {
    repository = { create: jest.fn(), findMany: jest.fn() };
    siemAdapter = { send: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: AuditLogRepository, useValue: repository },
        { provide: SIEM_ADAPTER, useValue: siemAdapter },
      ],
    }).compile();

    service = moduleRef.get(AuditLogService);
  });

  describe("record", () => {
    it("repassa o input para o repository", async () => {
      repository.create.mockResolvedValue({ id: "log-1" });
      await service.record({
        tenantId: "tenant-1",
        userId: "user-1",
        action: "CREATE",
        entityType: "Assessment",
        entityId: "a1",
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE", entityType: "Assessment" }),
      );
    });

    it("nunca lança — uma falha ao gravar não pode derrubar a ação de negócio auditada", async () => {
      repository.create.mockRejectedValue(new Error("db indisponível"));
      await expect(
        service.record({ action: "CREATE", entityType: "Assessment" }),
      ).resolves.toBeUndefined();
    });

    it("encaminha o evento para o SIEM", async () => {
      repository.create.mockResolvedValue({ id: "log-1" });
      await service.record({
        tenantId: "tenant-1",
        userId: "user-1",
        action: "LOGIN",
        entityType: "User",
        entityId: "user-1",
      });
      expect(siemAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-1", action: "LOGIN", entityType: "User" }),
      );
    });

    it("nunca lança quando o SIEM falha, mesmo que a gravação local tenha funcionado", async () => {
      repository.create.mockResolvedValue({ id: "log-1" });
      siemAdapter.send.mockRejectedValue(new Error("siem indisponível"));
      await expect(
        service.record({ action: "CREATE", entityType: "Assessment" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("list", () => {
    it("repassa filtros e paginação para o repository", async () => {
      repository.findMany.mockResolvedValue({ items: [], total: 0 });
      await service.list({ tenantId: "tenant-1" }, 2, 10);
      expect(repository.findMany).toHaveBeenCalledWith({ tenantId: "tenant-1" }, 2, 10);
    });
  });
});
