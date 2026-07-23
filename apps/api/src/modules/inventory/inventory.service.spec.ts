import { Test } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryRepository } from "./inventory.repository";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    homeTenantId: "tenant-1",
    email: "a@b.com",
    name: "A",
    permissions: [],
    isSuperAdmin: false,
    ...overrides,
  };
}

const approvedAssessment = {
  id: "assessment-1",
  softwareName: "Sistema X",
  vendor: "Fornecedor X",
  version: "1.0.0",
  url: null,
  areaId: "area-1",
  criticality: "MEDIUM" as const,
  responsibleId: "responsible-1",
};

describe("InventoryService", () => {
  let service: InventoryService;
  let repo: {
    create: jest.Mock;
    findById: jest.Mock;
    findByAssessmentId: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    setDocumentationLinks: jest.Mock;
    findDueForReview: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((data) => Promise.resolve({ id: "item-1", ...data })),
      findById: jest.fn(),
      findByAssessmentId: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      setDocumentationLinks: jest.fn().mockResolvedValue(undefined),
      findDueForReview: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [InventoryService, { provide: InventoryRepository, useValue: repo }],
    }).compile();

    service = moduleRef.get(InventoryService);
  });

  describe("createFromApprovedAssessment", () => {
    it("cria um item novo com valores padrão quando nenhum existe para a avaliação", async () => {
      const item = await service.createFromApprovedAssessment("tenant-1", approvedAssessment);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          assessmentId: "assessment-1",
          name: "Sistema X",
          managerId: "responsible-1",
          technicalResponsibleId: "responsible-1",
          category: "Não classificado",
          type: "SAAS",
          dataClassification: "INTERNAL",
        }),
      );
      expect(item.id).toBe("item-1");
    });

    it("calcula nextReviewDate 12 meses à frente da homologação", async () => {
      await service.createFromApprovedAssessment("tenant-1", approvedAssessment);
      const callArgs = repo.create.mock.calls[0][0];
      const monthsDiff =
        (callArgs.nextReviewDate.getFullYear() - callArgs.homologationDate.getFullYear()) * 12 +
        (callArgs.nextReviewDate.getMonth() - callArgs.homologationDate.getMonth());
      expect(monthsDiff).toBe(12);
    });

    it("atualiza o item existente em vez de duplicar quando já há um para esta avaliação", async () => {
      repo.findByAssessmentId.mockResolvedValue({ id: "item-existente" });

      await service.createFromApprovedAssessment("tenant-1", approvedAssessment);

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(
        "item-existente",
        expect.objectContaining({ name: "Sistema X" }),
      );
    });
  });

  describe("getById / update (tenant scoping)", () => {
    it("lança NotFoundException se o item não existir", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getById(makeUser(), "item-1")).rejects.toThrow(NotFoundException);
    });

    it("lança ForbiddenException para item de outro tenant", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "outro-tenant" });
      await expect(service.getById(makeUser(), "item-1")).rejects.toThrow(ForbiddenException);
    });

    it("permite acesso a item do próprio tenant", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1" });
      const result = await service.getById(makeUser(), "item-1");
      expect(result.id).toBe("item-1");
    });
  });

  describe("technicalOpinion (vínculo com o parecer da homologação)", () => {
    const opinion = {
      id: "opinion-1",
      number: "SECOPS-SW-072026-001",
      classificationLabel: "Homologado",
      issuedAt: new Date("2026-07-20"),
    };

    it("expõe o parecer técnico quando a avaliação vinculada tem um", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        assessment: { versions: [{ technicalOpinion: opinion }] },
      });
      const result = await service.getById(makeUser(), "item-1");
      expect(result.technicalOpinion).toEqual(opinion);
      expect(result).not.toHaveProperty("assessment");
    });

    it("technicalOpinion é null para item de entrada manual (sem assessmentId)", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1", assessment: null });
      const result = await service.getById(makeUser(), "item-1");
      expect(result.technicalOpinion).toBeNull();
    });

    it("repassa technicalOpinion em cada item da listagem", async () => {
      repo.findMany.mockResolvedValue({
        items: [
          { id: "item-1", assessment: { versions: [{ technicalOpinion: opinion }] } },
          { id: "item-2", assessment: null },
        ],
        total: 2,
      });
      const result = await service.list(makeUser(), {});
      expect(result.items[0]!.technicalOpinion).toEqual(opinion);
      expect(result.items[1]!.technicalOpinion).toBeNull();
    });
  });

  describe("documentationLinks", () => {
    const links = [{ label: "Swagger", url: "https://api.example.com/swagger" }];

    it("create() repassa documentationLinks pro repository como segundo argumento", async () => {
      await service.create(makeUser(), {
        name: "API X",
        vendor: "Fornecedor X",
        category: "Integração",
        type: "API_INTEGRATION",
        areaId: "area-1",
        managerId: "user-1",
        technicalResponsibleId: "user-1",
        homologationDate: "2026-07-01",
        nextReviewDate: "2027-07-01",
        criticality: "MEDIUM",
        dataClassification: "INTERNAL",
        documentationLinks: links,
      } as never);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "API X" }), links);
    });

    it("update() substitui os links e refaz o fetch quando documentationLinks é enviado", async () => {
      repo.findById
        .mockResolvedValueOnce({ id: "item-1", tenantId: "tenant-1" }) // getOwnedOrThrow
        .mockResolvedValueOnce({ id: "item-1", tenantId: "tenant-1", documentationLinks: links }); // refetch pós-update

      const result = await service.update(makeUser(), "item-1", { documentationLinks: links } as never);

      expect(repo.setDocumentationLinks).toHaveBeenCalledWith("item-1", "tenant-1", links);
      expect(result.documentationLinks).toEqual(links);
    });

    it("update() não toca nos links quando documentationLinks não é enviado", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1" });

      await service.update(makeUser(), "item-1", { vendor: "Novo nome" } as never);

      expect(repo.setDocumentationLinks).not.toHaveBeenCalled();
    });
  });
});
