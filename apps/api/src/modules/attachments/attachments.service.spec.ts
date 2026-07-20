import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AttachmentsService } from "./attachments.service";
import { AttachmentsRepository } from "./attachments.repository";
import { AuditLogService } from "../audit/audit-log.service";
import { STORAGE_ADAPTER } from "../storage/storage.interface";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    email: "a@b.com",
    name: "A",
    permissions: [],
    ...overrides,
  };
}

function makeFile(): Express.Multer.File {
  return {
    originalname: "contrato.pdf",
    buffer: Buffer.from("conteudo"),
    mimetype: "application/pdf",
    size: 8,
  } as Express.Multer.File;
}

describe("AttachmentsService", () => {
  let service: AttachmentsService;
  let repo: {
    create: jest.Mock;
    findById: jest.Mock;
    findMany: jest.Mock;
    findMaxVersion: jest.Mock;
    findAssessmentContext: jest.Mock;
    findInventoryItemContext: jest.Mock;
  };
  let auditLogService: { record: jest.Mock };
  let storage: { save: jest.Mock; read: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((data) => Promise.resolve({ id: "att-1", ...data })),
      findById: jest.fn(),
      findMany: jest.fn(),
      findMaxVersion: jest.fn().mockResolvedValue(0),
      findAssessmentContext: jest.fn(),
      findInventoryItemContext: jest.fn(),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    storage = { save: jest.fn().mockResolvedValue(undefined), read: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: AttachmentsRepository, useValue: repo },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: STORAGE_ADAPTER, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(AttachmentsService);
  });

  describe("upload", () => {
    it("lança BadRequestException se nenhum pai for informado", async () => {
      await expect(
        service.upload(makeUser(), { category: "CONTRACT" }, makeFile()),
      ).rejects.toThrow(BadRequestException);
    });

    it("lança BadRequestException se os dois pais forem informados", async () => {
      await expect(
        service.upload(
          makeUser(),
          { category: "CONTRACT", assessmentId: "a1", inventoryItemId: "i1" },
          makeFile(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("bloqueia upload para avaliação de quem não é o requester nem tem view-all", async () => {
      repo.findAssessmentContext.mockResolvedValue({
        id: "a1",
        tenantId: "tenant-1",
        requesterId: "outro-user",
      });
      await expect(
        service.upload(makeUser(), { category: "CONTRACT", assessmentId: "a1" }, makeFile()),
      ).rejects.toThrow(ForbiddenException);
    });

    it("permite upload pelo requester e salva com version 1 na primeira vez", async () => {
      repo.findAssessmentContext.mockResolvedValue({
        id: "a1",
        tenantId: "tenant-1",
        requesterId: "user-1",
      });

      const attachment = await service.upload(
        makeUser(),
        { category: "CONTRACT", assessmentId: "a1" },
        makeFile(),
      );

      expect(storage.save).toHaveBeenCalledWith(
        expect.stringContaining("attachments/tenant-1/a1/"),
        expect.any(Buffer),
      );
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }));
      expect(attachment.id).toBe("att-1");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE", entityType: "Attachment" }),
      );
    });

    it("incrementa a versão quando já existe um arquivo com o mesmo nome", async () => {
      repo.findAssessmentContext.mockResolvedValue({
        id: "a1",
        tenantId: "tenant-1",
        requesterId: "user-1",
      });
      repo.findMaxVersion.mockResolvedValue(2);

      await service.upload(makeUser(), { category: "CONTRACT", assessmentId: "a1" }, makeFile());

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ version: 3 }));
    });

    it("upload para inventário exige inventory:manage", async () => {
      await expect(
        service.upload(makeUser(), { category: "OTHER", inventoryItemId: "i1" }, makeFile()),
      ).rejects.toThrow(ForbiddenException);
    });

    it("permite upload para inventário com inventory:manage", async () => {
      repo.findInventoryItemContext.mockResolvedValue({ id: "i1", tenantId: "tenant-1" });
      const user = makeUser({ permissions: ["inventory:manage"] });

      await service.upload(user, { category: "OTHER", inventoryItemId: "i1" }, makeFile());

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ inventoryItemId: "i1", version: 1 }),
      );
    });
  });

  describe("download", () => {
    it("lança NotFoundException se o anexo não existir", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.download(makeUser(), "att-1")).rejects.toThrow(NotFoundException);
    });

    it("bloqueia acesso de outro tenant", async () => {
      repo.findById.mockResolvedValue({ id: "att-1", tenantId: "outro-tenant" });
      await expect(service.download(makeUser(), "att-1")).rejects.toThrow(ForbiddenException);
    });

    it("permite download pelo requester da avaliação", async () => {
      repo.findById.mockResolvedValue({
        id: "att-1",
        tenantId: "tenant-1",
        assessmentId: "a1",
        inventoryItemId: null,
        fileName: "contrato.pdf",
        version: 1,
        storageKey: "key.pdf",
      });
      repo.findAssessmentContext.mockResolvedValue({
        id: "a1",
        tenantId: "tenant-1",
        requesterId: "user-1",
      });
      storage.read.mockResolvedValue(Buffer.from("pdf-bytes"));

      const result = await service.download(makeUser(), "att-1");

      expect(result.buffer.toString()).toBe("pdf-bytes");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "DOWNLOAD", entityType: "Attachment" }),
      );
    });
  });
});
