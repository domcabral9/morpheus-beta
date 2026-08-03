import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryRepository } from "./inventory.repository";
import { InventoryApprovalRepository } from "./inventory-approval.repository";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import { PERMISSIONS } from "../../common/constants/permissions";
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
  vendorId: "vendor-1",
  version: "1.0.0",
  url: null,
  areaId: "area-1",
  criticality: "MEDIUM" as const,
  responsibleId: "responsible-1",
  hasRiskAnalysis: true,
  hasInfoSecClause: false,
};

describe("InventoryService", () => {
  let service: InventoryService;
  let repo: {
    create: jest.Mock;
    createWithApprovalRequest: jest.Mock;
    findById: jest.Mock;
    findByAssessmentId: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    setDocumentationLinks: jest.Mock;
    findAllMatching: jest.Mock;
    getStats: jest.Mock;
    findDueForReview: jest.Mock;
  };
  let approvalRepo: {
    findByItemId: jest.Mock;
    markDecided: jest.Mock;
    resetForResubmit: jest.Mock;
    findPendingItems: jest.Mock;
  };
  let auditLogService: { record: jest.Mock };
  let notificationsService: { notify: jest.Mock; notifyPermissionHolders: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((data) => Promise.resolve({ id: "item-1", ...data })),
      createWithApprovalRequest: jest
        .fn()
        .mockImplementation((data) => Promise.resolve({ id: "item-1", ...data })),
      findById: jest.fn(),
      findByAssessmentId: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      setDocumentationLinks: jest.fn().mockResolvedValue(undefined),
      findAllMatching: jest.fn(),
      getStats: jest.fn(),
      findDueForReview: jest.fn(),
    };
    approvalRepo = {
      findByItemId: jest.fn(),
      markDecided: jest.fn().mockResolvedValue(undefined),
      resetForResubmit: jest.fn().mockResolvedValue(undefined),
      findPendingItems: jest.fn(),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyPermissionHolders: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: InventoryRepository, useValue: repo },
        { provide: InventoryApprovalRepository, useValue: approvalRepo },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: NotificationsService, useValue: notificationsService },
        SeparationOfDutiesService,
      ],
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
          vendorId: "vendor-1",
        }),
      );
      expect(item.id).toBe("item-1");
    });

    it("propaga vendorId null quando a avaliação não tem fornecedor vinculado (texto livre)", async () => {
      await service.createFromApprovedAssessment("tenant-1", {
        ...approvedAssessment,
        vendorId: null,
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ vendorId: null }));
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
        expect.objectContaining({ name: "Sistema X", vendorId: "vendor-1" }),
      );
    });

    it("renovação aprovada reseta nextReviewDate (+12 meses) e status ACTIVE, mesmo se o item estava EXPIRED", async () => {
      repo.findByAssessmentId.mockResolvedValue({
        id: "item-existente",
        status: "EXPIRED",
        nextReviewDate: new Date("2026-01-01"),
      });

      await service.createFromApprovedAssessment("tenant-1", approvedAssessment);

      const [, updateArgs] = repo.update.mock.calls[0];
      expect(updateArgs.status).toBe("ACTIVE");
      const now = new Date();
      const monthsDiff =
        (updateArgs.nextReviewDate.getFullYear() - now.getFullYear()) * 12 +
        (updateArgs.nextReviewDate.getMonth() - now.getMonth());
      expect(monthsDiff).toBe(12);
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

      expect(repo.createWithApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({ name: "API X" }),
        "user-1",
        links,
      );
    });

    it("update() substitui os links e refaz o fetch quando documentationLinks é enviado", async () => {
      repo.findById
        .mockResolvedValueOnce({ id: "item-1", tenantId: "tenant-1" }) // getOwnedOrThrow
        .mockResolvedValueOnce({ id: "item-1", tenantId: "tenant-1", documentationLinks: links }); // refetch pós-update

      const result = await service.update(makeUser(), "item-1", {
        documentationLinks: links,
      } as never);

      expect(repo.setDocumentationLinks).toHaveBeenCalledWith("item-1", "tenant-1", links);
      expect(result.documentationLinks).toEqual(links);
    });

    it("update() não toca nos links quando documentationLinks não é enviado", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1" });

      await service.update(makeUser(), "item-1", { vendor: "Novo nome" } as never);

      expect(repo.setDocumentationLinks).not.toHaveBeenCalled();
    });
  });

  describe("vendorCompliance (ART/cláusula InfoSec)", () => {
    it("create() repassa hasRiskAnalysis/hasInfoSecClause pro repository", async () => {
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
        hasRiskAnalysis: true,
        hasInfoSecClause: false,
      } as never);

      expect(repo.createWithApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({ hasRiskAnalysis: true, hasInfoSecClause: false }),
        "user-1",
        undefined,
      );
    });

    it("update() rejeita mudar hasRiskAnalysis/hasInfoSecClause em item com assessmentId (herdado da homologação)", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        assessmentId: "assessment-1",
      });

      await expect(
        service.update(makeUser(), "item-1", { hasRiskAnalysis: false } as never),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("update() permite mudar hasRiskAnalysis/hasInfoSecClause em item de entrada manual (sem assessmentId)", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1", assessmentId: null });

      await service.update(makeUser(), "item-1", { hasRiskAnalysis: true } as never);

      expect(repo.update).toHaveBeenCalledWith(
        "item-1",
        expect.objectContaining({ hasRiskAnalysis: true }),
      );
    });

    it("update() de outros campos continua funcionando normalmente em item homologado", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        assessmentId: "assessment-1",
      });

      await service.update(makeUser(), "item-1", { vendor: "Novo nome" } as never);

      expect(repo.update).toHaveBeenCalledWith(
        "item-1",
        expect.objectContaining({ vendor: "Novo nome" }),
      );
    });
  });

  describe("getStats", () => {
    it("repassa tenantId e a janela de revisão pro repository", async () => {
      repo.getStats.mockResolvedValue({ totalItems: 0 });

      await service.getStats(makeUser());

      expect(repo.getStats).toHaveBeenCalledWith("tenant-1", 30);
    });
  });

  describe("exportItems", () => {
    it("busca sem paginação com os mesmos filtros da listagem e registra auditoria", async () => {
      repo.findAllMatching.mockResolvedValue([
        { id: "item-1", tenantId: "tenant-1", assessment: null },
        { id: "item-2", tenantId: "tenant-1", assessment: null },
      ]);

      const user = makeUser();
      const result = await service.exportItems(user, {
        status: "ACTIVE",
        areaId: "area-1",
      } as never);

      expect(repo.findAllMatching).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        status: "ACTIVE",
        areaId: "area-1",
      });
      expect(result).toHaveLength(2);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          userId: user.id,
          action: "DOWNLOAD",
          entityType: "SoftwareInventoryItem",
          metadata: { format: "csv", count: 2 },
        }),
      );
    });
  });

  const validCreateDto = {
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
    hasRiskAnalysis: true,
    hasInfoSecClause: false,
  };

  describe("create - gate de aprovação manual", () => {
    it("força status PENDING_APPROVAL e createdById, nunca aceita status do DTO", async () => {
      await service.create(makeUser(), validCreateDto as never);

      expect(repo.createWithApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: "PENDING_APPROVAL", createdById: "user-1" }),
        "user-1",
        undefined,
      );
    });

    it("grava audit SUBMIT e notifica todos com assessments:approve", async () => {
      await service.create(makeUser(), validCreateDto as never);

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "SUBMIT", entityType: "InventoryApprovalRequest" }),
      );
      expect(notificationsService.notifyPermissionHolders).toHaveBeenCalledWith(
        "tenant-1",
        PERMISSIONS.ASSESSMENTS_APPROVE,
        expect.objectContaining({ type: "INVENTORY_APPROVAL_REQUESTED" }),
      );
    });
  });

  describe("update - bypass de status fechado", () => {
    it("rejeita dto.status quando o item está PENDING_APPROVAL", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        status: "PENDING_APPROVAL",
      });

      await expect(
        service.update(makeUser(), "item-1", { status: "ACTIVE" } as never),
      ).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rejeita dto.status quando o item está REJECTED", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1", status: "REJECTED" });

      await expect(
        service.update(makeUser(), "item-1", { status: "ACTIVE" } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejeita setar PENDING_APPROVAL/REJECTED à mão em item ACTIVE (nunca atribuível fora do fluxo)", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1", status: "ACTIVE" });

      await expect(
        service.update(makeUser(), "item-1", { status: "PENDING_APPROVAL" } as never),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(makeUser(), "item-1", { status: "REJECTED" } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("approve/reject", () => {
    it("rejeita item que não está PENDING_APPROVAL", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1", status: "ACTIVE" });

      await expect(service.approve(makeUser(), "item-1", {})).rejects.toThrow(BadRequestException);
      await expect(service.reject(makeUser(), "item-1", { notes: "motivo" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("bloqueia auto-aprovação: criador não pode aprovar a própria submissão", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        status: "PENDING_APPROVAL",
      });
      approvalRepo.findByItemId.mockResolvedValue({ id: "req-1", requesterId: "user-1" });

      await expect(service.approve(makeUser({ id: "user-1" }), "item-1", {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(approvalRepo.markDecided).not.toHaveBeenCalled();
    });

    it("bloqueia auto-reprovação da mesma forma", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        status: "PENDING_APPROVAL",
      });
      approvalRepo.findByItemId.mockResolvedValue({ id: "req-1", requesterId: "user-1" });

      await expect(
        service.reject(makeUser({ id: "user-1" }), "item-1", { notes: "motivo" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("aprova: marca a request decidida, ativa o item, audita e notifica o criador", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        status: "PENDING_APPROVAL",
        name: "API X",
      });
      approvalRepo.findByItemId.mockResolvedValue({ id: "req-1", requesterId: "user-2" });

      await service.approve(makeUser({ id: "user-1" }), "item-1", { notes: "ok" });

      expect(approvalRepo.markDecided).toHaveBeenCalledWith("req-1", {
        status: "APPROVED",
        decidedById: "user-1",
        decisionNotes: "ok",
      });
      expect(repo.update).toHaveBeenCalledWith("item-1", { status: "ACTIVE" });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "APPROVE", entityType: "InventoryApprovalRequest" }),
      );
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-2", type: "APPROVAL" }),
      );
    });

    it("reprova: marca REJECTED, atualiza o item, audita e notifica o criador com o motivo", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        status: "PENDING_APPROVAL",
        name: "API X",
      });
      approvalRepo.findByItemId.mockResolvedValue({ id: "req-1", requesterId: "user-2" });

      await service.reject(makeUser({ id: "user-1" }), "item-1", {
        notes: "Fornecedor sem contrato vigente",
      });

      expect(approvalRepo.markDecided).toHaveBeenCalledWith("req-1", {
        status: "REJECTED",
        decidedById: "user-1",
        decisionNotes: "Fornecedor sem contrato vigente",
      });
      expect(repo.update).toHaveBeenCalledWith("item-1", { status: "REJECTED" });
      expect(notificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-2",
          type: "REJECTION",
          body: expect.stringContaining("Fornecedor sem contrato vigente"),
        }),
      );
    });
  });

  describe("resubmit", () => {
    it("rejeita item que não está REJECTED", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1", status: "ACTIVE" });

      await expect(service.resubmit(makeUser(), "item-1")).rejects.toThrow(BadRequestException);
    });

    it("rejeita não-criador tentando reenviar item alheio", async () => {
      repo.findById.mockResolvedValue({ id: "item-1", tenantId: "tenant-1", status: "REJECTED" });
      approvalRepo.findByItemId.mockResolvedValue({ id: "req-1", requesterId: "user-2" });

      await expect(service.resubmit(makeUser({ id: "user-1" }), "item-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(approvalRepo.resetForResubmit).not.toHaveBeenCalled();
    });

    it("permite ao criador reenviar: reseta a request e volta o item pra PENDING_APPROVAL", async () => {
      repo.findById.mockResolvedValue({
        id: "item-1",
        tenantId: "tenant-1",
        status: "REJECTED",
        name: "API X",
      });
      approvalRepo.findByItemId.mockResolvedValue({ id: "req-1", requesterId: "user-1" });

      await service.resubmit(makeUser({ id: "user-1" }), "item-1");

      expect(approvalRepo.resetForResubmit).toHaveBeenCalledWith("req-1");
      expect(repo.update).toHaveBeenCalledWith("item-1", { status: "PENDING_APPROVAL" });
      expect(notificationsService.notifyPermissionHolders).toHaveBeenCalledWith(
        "tenant-1",
        PERMISSIONS.ASSESSMENTS_APPROVE,
        expect.objectContaining({ type: "INVENTORY_APPROVAL_REQUESTED" }),
      );
    });
  });
});
