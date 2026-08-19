import { Test } from "@nestjs/testing";
import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
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
    createAssessment: jest.Mock;
    updateAssessment: jest.Mock;
    findAssessmentById: jest.Mock;
    replaceAnswers: jest.Mock;
    findComplianceEvidence: jest.Mock;
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
      createAssessment: jest
        .fn()
        .mockImplementation((data) => Promise.resolve({ id: "va-new", ...data })),
      updateAssessment: jest
        .fn()
        .mockImplementation((id, data) => Promise.resolve({ id, ...data })),
      findAssessmentById: jest.fn(),
      replaceAnswers: jest.fn().mockResolvedValue(undefined),
      findComplianceEvidence: jest.fn().mockResolvedValue([]),
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
});
