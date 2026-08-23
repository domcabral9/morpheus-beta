import { Test } from "@nestjs/testing";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { VendorsService } from "./vendors.service";
import { VendorsRepository } from "./vendors.repository";
import { RiskEngineService } from "../risk-engine/risk-engine.service";
import { AuditLogService } from "../audit/audit-log.service";
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

const TIER_CONFIG_ACTIVE = {
  id: "tier-config-1",
  tenantId: "tenant-1",
  name: "Config Padrão",
  version: 1,
  isActive: true,
  thresholds: [
    {
      id: "t1",
      tier: 1,
      label: "Baixo risco",
      color: "#16a34a",
      minScore: 4.0,
      maxScore: 5.0,
      baseReassessmentMonths: 12,
    },
    {
      id: "t2",
      tier: 2,
      label: "Risco moderado",
      color: "#65a30d",
      minScore: 3.0,
      maxScore: 3.99,
      baseReassessmentMonths: 6,
    },
    {
      id: "t3",
      tier: 3,
      label: "Risco elevado",
      color: "#ea580c",
      minScore: 2.0,
      maxScore: 2.99,
      baseReassessmentMonths: 4,
    },
    {
      id: "t4",
      tier: 4,
      label: "Risco crítico",
      color: "#dc2626",
      minScore: 0,
      maxScore: 1.99,
      baseReassessmentMonths: 3,
    },
  ],
};

const VENDOR = {
  id: "vendor-1",
  tenantId: "tenant-1",
  name: "Fornecedor X",
  businessCriticality: "MEDIUM" as const,
};

const DRAFT_ASSESSMENT = {
  id: "va-1",
  tenantId: "tenant-1",
  vendorId: "vendor-1",
  vendorTierConfigId: "tier-config-1",
  status: "DRAFT" as const,
  vendor: VENDOR,
  performedBy: { id: "user-1", name: "A", email: "a@b.com", avatarPath: null as string | null },
  answers: [
    {
      id: "answer-1",
      vendorQuestion: { id: "q1", weight: 3, type: "SINGLE_CHOICE" as const },
      scaleValue: null,
      selectedOptions: [{ vendorQuestionOption: { score: 0 } }],
    },
    {
      id: "answer-2",
      vendorQuestion: { id: "q2", weight: 1, type: "SCALE" as const },
      scaleValue: 0,
      selectedOptions: [],
    },
  ],
};

describe("VendorsService", () => {
  let service: VendorsService;
  let repo: {
    findMany: jest.Mock;
    findForTracking: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findAssessmentHistory: jest.Mock;
    findActiveTierConfig: jest.Mock;
    findTierConfigById: jest.Mock;
    listTierConfigs: jest.Mock;
    createTierConfig: jest.Mock;
    activateTierConfig: jest.Mock;
    upsertThreshold: jest.Mock;
    createAssessment: jest.Mock;
    updateAssessment: jest.Mock;
    findAssessmentById: jest.Mock;
    replaceAnswers: jest.Mock;
    findComplianceEvidence: jest.Mock;
    remove: jest.Mock;
    countAssessments: jest.Mock;
    countLinkedRecords: jest.Mock;
  };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findMany: jest.fn(),
      findForTracking: jest.fn(),
      findById: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((data) => Promise.resolve({ id: "vendor-new", ...data })),
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      findAssessmentHistory: jest.fn(),
      findActiveTierConfig: jest.fn(),
      findTierConfigById: jest.fn(),
      listTierConfigs: jest.fn().mockResolvedValue([]),
      createTierConfig: jest
        .fn()
        .mockImplementation((data) => Promise.resolve({ id: "tier-config-new", ...data })),
      activateTierConfig: jest
        .fn()
        .mockImplementation((tenantId, id) => Promise.resolve({ id, isActive: true })),
      upsertThreshold: jest.fn().mockResolvedValue(undefined),
      createAssessment: jest
        .fn()
        .mockImplementation((data) => Promise.resolve({ id: "va-new", ...data })),
      updateAssessment: jest
        .fn()
        .mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      findAssessmentById: jest.fn(),
      replaceAnswers: jest.fn().mockResolvedValue(undefined),
      findComplianceEvidence: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
      countAssessments: jest.fn().mockResolvedValue(0),
      countLinkedRecords: jest
        .fn()
        .mockResolvedValue({ inventoryCount: 0, assessmentCount: 0, vendorAssessmentCount: 0 }),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VendorsService,
        { provide: VendorsRepository, useValue: repo },
        RiskEngineService,
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(VendorsService);
  });

  describe("createVendor", () => {
    it("rejeita isSampleData:true de usuário sem platform:cross-tenant", () => {
      expect(() =>
        service.createVendor(makeUser(), { name: "Sample Co", isSampleData: true }),
      ).toThrow(ForbiddenException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("aceita isSampleData:true de super-admin", async () => {
      await service.createVendor(makeUser({ isSuperAdmin: true }), {
        name: "Sample Co",
        isSampleData: true,
      });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isSampleData: true }));
    });

    it("cria com isSampleData:false por padrão quando omitido", async () => {
      await service.createVendor(makeUser(), { name: "Real Co" });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ isSampleData: false }));
    });
  });

  describe("getVendor", () => {
    it("lança NotFoundException quando o fornecedor não existe no tenant", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getVendor(makeUser(), "unknown")).rejects.toThrow(NotFoundException);
    });

    it("retorna o fornecedor quando encontrado", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      await expect(service.getVendor(makeUser(), "vendor-1")).resolves.toEqual(VENDOR);
    });
  });

  describe("removeVendor", () => {
    it("lança NotFoundException quando o fornecedor não existe no tenant", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.removeVendor(makeUser(), "unknown")).rejects.toThrow(NotFoundException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it("apaga o fornecedor quando encontrado no tenant do usuário", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      await service.removeVendor(makeUser(), "vendor-1");
      expect(repo.remove).toHaveBeenCalledWith("vendor-1");
    });
  });

  describe("countVendorAssessments", () => {
    it("delega pro repository", async () => {
      repo.countAssessments.mockResolvedValue(2);
      await expect(service.countVendorAssessments("vendor-1")).resolves.toBe(2);
      expect(repo.countAssessments).toHaveBeenCalledWith("vendor-1");
    });
  });

  describe("getDeletionInfo", () => {
    it("lança NotFoundException quando o fornecedor não existe no tenant", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getDeletionInfo(makeUser(), "unknown")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("canDelete: true quando as 3 contagens são zero", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      repo.countLinkedRecords.mockResolvedValue({
        inventoryCount: 0,
        assessmentCount: 0,
        vendorAssessmentCount: 0,
      });
      await expect(service.getDeletionInfo(makeUser(), "vendor-1")).resolves.toEqual({
        canDelete: true,
        inventoryCount: 0,
        assessmentCount: 0,
        vendorAssessmentCount: 0,
      });
    });

    it.each([
      { inventoryCount: 1, assessmentCount: 0, vendorAssessmentCount: 0 },
      { inventoryCount: 0, assessmentCount: 1, vendorAssessmentCount: 0 },
      { inventoryCount: 0, assessmentCount: 0, vendorAssessmentCount: 1 },
      { inventoryCount: 2, assessmentCount: 1, vendorAssessmentCount: 3 },
    ])("canDelete: false quando qualquer contagem é > 0 (%o)", async (counts) => {
      repo.findById.mockResolvedValue(VENDOR);
      repo.countLinkedRecords.mockResolvedValue(counts);
      const result = await service.getDeletionInfo(makeUser(), "vendor-1");
      expect(result.canDelete).toBe(false);
    });
  });

  describe("deleteVendor", () => {
    it("lança NotFoundException quando o fornecedor não existe no tenant, sem chamar remove", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.deleteVendor(makeUser(), "unknown")).rejects.toThrow(NotFoundException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it("apaga e audita quando as 3 contagens são zero", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      repo.countLinkedRecords.mockResolvedValue({
        inventoryCount: 0,
        assessmentCount: 0,
        vendorAssessmentCount: 0,
      });
      await service.deleteVendor(makeUser(), "vendor-1");
      expect(repo.remove).toHaveBeenCalledWith("vendor-1");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "DELETE", entityType: "Vendor", entityId: "vendor-1" }),
      );
    });

    it("lança ConflictException VENDOR_HAS_ACTIVE_LINKS e não apaga quando qualquer contagem é > 0 (reverifica sempre, não confia num GET anterior)", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      repo.countLinkedRecords.mockResolvedValue({
        inventoryCount: 1,
        assessmentCount: 0,
        vendorAssessmentCount: 0,
      });
      await expect(service.deleteVendor(makeUser(), "vendor-1")).rejects.toMatchObject({
        response: expect.objectContaining({ error: "VENDOR_HAS_ACTIVE_LINKS" }),
      });
      expect(repo.remove).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it("lança ConflictException também quando só há VendorAssessment (ART) vinculada", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      repo.countLinkedRecords.mockResolvedValue({
        inventoryCount: 0,
        assessmentCount: 0,
        vendorAssessmentCount: 1,
      });
      await expect(service.deleteVendor(makeUser(), "vendor-1")).rejects.toThrow(ConflictException);
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  describe("getComplianceEvidence", () => {
    it("lança NotFoundException quando o fornecedor não existe no tenant (isolamento)", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.getComplianceEvidence(makeUser(), "vendor-de-outro-tenant"),
      ).rejects.toThrow(NotFoundException);
      expect(repo.findComplianceEvidence).not.toHaveBeenCalled();
    });

    it("devolve as avaliações de software com SOC 2/ISO 27001 declarados para o fornecedor", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      const evidence = [
        {
          id: "assessment-1",
          softwareName: "Confluence Cloud",
          hasSoc2Report: true,
          hasIso27001Certificate: false,
        },
      ];
      repo.findComplianceEvidence.mockResolvedValue(evidence);

      const result = await service.getComplianceEvidence(makeUser(), "vendor-1");

      expect(repo.findComplianceEvidence).toHaveBeenCalledWith("tenant-1", "vendor-1");
      expect(result).toEqual(evidence);
    });
  });

  describe("getTracking", () => {
    it("repassa tenantId e a janela de dias pro repository, devolvendo os 3 baldes", async () => {
      const buckets = { neverAssessed: [VENDOR], overdue: [], dueSoon: [] };
      repo.findForTracking.mockResolvedValue(buckets);

      const result = await service.getTracking(makeUser());

      expect(result).toEqual(buckets);
      expect(repo.findForTracking).toHaveBeenCalledWith("tenant-1", expect.any(Date), 30);
    });
  });

  describe("getAssessment", () => {
    it("lança NotFoundException quando a avaliação não existe", async () => {
      repo.findAssessmentById.mockResolvedValue(null);
      await expect(service.getAssessment(makeUser(), "vendor-1", "va-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lança NotFoundException quando a avaliação pertence a outro vendor", async () => {
      repo.findAssessmentById.mockResolvedValue({ ...DRAFT_ASSESSMENT, vendorId: "outro-vendor" });
      await expect(service.getAssessment(makeUser(), "vendor-1", "va-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("retorna a avaliação (DRAFT ou COMPLETED, sem restrição de status)", async () => {
      repo.findAssessmentById.mockResolvedValue({ ...DRAFT_ASSESSMENT, status: "COMPLETED" });
      await expect(service.getAssessment(makeUser(), "vendor-1", "va-1")).resolves.toEqual(
        expect.objectContaining({ id: "va-1", status: "COMPLETED" }),
      );
    });
  });

  describe("createDraftAssessment", () => {
    it("usa a config de tier ativa do tenant quando nenhuma é especificada", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      repo.findActiveTierConfig.mockResolvedValue(TIER_CONFIG_ACTIVE);
      repo.findAssessmentById.mockResolvedValue(DRAFT_ASSESSMENT);

      await service.createDraftAssessment(makeUser(), "vendor-1", {});

      expect(repo.createAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ vendorTierConfigId: "tier-config-1", status: "DRAFT" }),
      );
    });

    it("lança UnprocessableEntityException quando não há config de tier disponível", async () => {
      repo.findById.mockResolvedValue(VENDOR);
      repo.findActiveTierConfig.mockResolvedValue(null);

      await expect(service.createDraftAssessment(makeUser(), "vendor-1", {})).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe("completeAssessment", () => {
    it("lança NotFoundException quando a avaliação não pertence ao vendor informado", async () => {
      repo.findAssessmentById.mockResolvedValue({ ...DRAFT_ASSESSMENT, vendorId: "outro-vendor" });

      await expect(service.completeAssessment(makeUser(), "vendor-1", "va-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lança UnprocessableEntityException se a avaliação já foi concluída", async () => {
      repo.findAssessmentById.mockResolvedValue({ ...DRAFT_ASSESSMENT, status: "COMPLETED" });

      await expect(service.completeAssessment(makeUser(), "vendor-1", "va-1")).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("lança UnprocessableEntityException se a config de tier não tem thresholds", async () => {
      repo.findAssessmentById.mockResolvedValue(DRAFT_ASSESSMENT);
      repo.findTierConfigById.mockResolvedValue({ ...TIER_CONFIG_ACTIVE, thresholds: [] });

      await expect(service.completeAssessment(makeUser(), "vendor-1", "va-1")).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("respostas 100% favoráveis (score de risco 0) classificam Tier 1 e cadência de 12 meses (MEDIUM)", async () => {
      repo.findAssessmentById.mockResolvedValue(DRAFT_ASSESSMENT);
      repo.findTierConfigById.mockResolvedValue(TIER_CONFIG_ACTIVE);

      const result = await service.completeAssessment(makeUser(), "vendor-1", "va-1");

      // Todas as respostas têm score de risco 0 -> totalScore final = 5 (RiskEngineService inverte 5 - risco).
      expect(repo.updateAssessment).toHaveBeenCalledWith(
        "va-1",
        expect.objectContaining({
          status: "COMPLETED",
          tier: 1,
          tierLabel: "Baixo risco",
          totalScore: 5,
        }),
      );
      // baseReassessmentMonths do Tier 1 é 12, criticidade MEDIUM (multiplicador 1.0) -> +12 meses.
      const vendorUpdateCall = repo.update.mock.calls[0];
      expect(vendorUpdateCall[0]).toBe("vendor-1");
      expect(vendorUpdateCall[1]).toEqual(
        expect.objectContaining({
          currentTier: 1,
          currentTierLabel: "Baixo risco",
          currentScore: 5,
        }),
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE", entityType: "VendorAssessment" }),
      );
      expect(result).toBeDefined();
    });

    it("respostas 100% desfavoráveis (score de risco 5) classificam Tier 4", async () => {
      const worstAssessment = {
        ...DRAFT_ASSESSMENT,
        answers: [
          {
            id: "answer-1",
            vendorQuestion: { id: "q1", weight: 3, type: "SINGLE_CHOICE" as const },
            scaleValue: null,
            selectedOptions: [{ vendorQuestionOption: { score: 5 } }],
          },
        ],
      };
      repo.findAssessmentById.mockResolvedValue(worstAssessment);
      repo.findTierConfigById.mockResolvedValue(TIER_CONFIG_ACTIVE);

      await service.completeAssessment(makeUser(), "vendor-1", "va-1");

      expect(repo.updateAssessment).toHaveBeenCalledWith(
        "va-1",
        expect.objectContaining({ tier: 4, tierLabel: "Risco crítico", totalScore: 0 }),
      );
    });
  });

  describe("getTierConfig", () => {
    it("lança 404 quando a config não existe no tenant", async () => {
      repo.findTierConfigById.mockResolvedValue(null);
      await expect(service.getTierConfig(makeUser(), "tier-config-x")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("devolve a config quando encontrada", async () => {
      repo.findTierConfigById.mockResolvedValue(TIER_CONFIG_ACTIVE);
      const result = await service.getTierConfig(makeUser(), "tier-config-1");
      expect(result).toBe(TIER_CONFIG_ACTIVE);
    });
  });

  describe("createTierConfig", () => {
    it("nasce version 1 quando é a primeira config do tenant, sem clonar nada", async () => {
      repo.listTierConfigs.mockResolvedValue([]);
      repo.findTierConfigById.mockResolvedValue({ id: "tier-config-new", thresholds: [] });
      await service.createTierConfig(makeUser(), { name: "Config Padrão" });

      expect(repo.createTierConfig).toHaveBeenCalledWith(
        expect.objectContaining({ version: 1, isActive: false }),
      );
      expect(repo.upsertThreshold).not.toHaveBeenCalled();
    });

    it("incrementa a partir da maior version existente", async () => {
      repo.listTierConfigs.mockResolvedValue([
        { ...TIER_CONFIG_ACTIVE, version: 1, isActive: false },
        { ...TIER_CONFIG_ACTIVE, id: "tier-config-2", version: 3, isActive: true },
      ]);
      repo.findTierConfigById.mockResolvedValue({ id: "tier-config-new", thresholds: [] });
      await service.createTierConfig(makeUser(), { name: "Config Nova" });

      expect(repo.createTierConfig).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }));
    });

    it("clona os thresholds da config ativa pra versão nova", async () => {
      repo.listTierConfigs.mockResolvedValue([TIER_CONFIG_ACTIVE]);
      repo.findTierConfigById.mockResolvedValue({ id: "tier-config-new", thresholds: [] });

      await service.createTierConfig(makeUser(), { name: "Config Nova" });

      expect(repo.upsertThreshold).toHaveBeenCalledTimes(TIER_CONFIG_ACTIVE.thresholds.length);
      expect(repo.upsertThreshold).toHaveBeenCalledWith(
        "tier-config-new",
        1,
        expect.objectContaining({ label: "Baixo risco" }),
      );
    });

    it("ativa imediatamente quando dto.activate é true", async () => {
      repo.listTierConfigs.mockResolvedValue([]);
      await service.createTierConfig(makeUser(), { name: "Config Nova", activate: true });
      expect(repo.activateTierConfig).toHaveBeenCalledWith("tenant-1", "tier-config-new");
    });
  });

  describe("activateTierConfig", () => {
    it("lança 404 quando a config não existe no tenant", async () => {
      repo.findTierConfigById.mockResolvedValue(null);
      await expect(service.activateTierConfig(makeUser(), "tier-config-x")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejeita ativar uma config sem nenhum threshold", async () => {
      repo.findTierConfigById.mockResolvedValue({ ...TIER_CONFIG_ACTIVE, thresholds: [] });
      await expect(service.activateTierConfig(makeUser(), "tier-config-1")).rejects.toThrow(
        "A configuração precisa de ao menos um tier definido antes de ser ativada.",
      );
      expect(repo.activateTierConfig).not.toHaveBeenCalled();
    });

    it("ativa quando há ao menos um threshold", async () => {
      repo.findTierConfigById.mockResolvedValue(TIER_CONFIG_ACTIVE);
      await service.activateTierConfig(makeUser(), "tier-config-1");
      expect(repo.activateTierConfig).toHaveBeenCalledWith("tenant-1", "tier-config-1");
    });
  });
});
