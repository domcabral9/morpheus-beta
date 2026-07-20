import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RiskMatrixService } from "./risk-matrix.service";
import { RiskMatrixRepository } from "./risk-matrix.repository";

describe("RiskMatrixService", () => {
  let service: RiskMatrixService;
  let repo: {
    findAllForTenant: jest.Mock;
    findById: jest.Mock;
    createConfig: jest.Mock;
    updateConfig: jest.Mock;
    activate: jest.Mock;
    createProbabilityLevel: jest.Mock;
    findProbabilityLevelById: jest.Mock;
    countRiskResultsUsingProbabilityLevel: jest.Mock;
    deleteProbabilityLevel: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findAllForTenant: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      createConfig: jest.fn(),
      updateConfig: jest.fn(),
      activate: jest.fn(),
      createProbabilityLevel: jest.fn(),
      findProbabilityLevelById: jest.fn(),
      countRiskResultsUsingProbabilityLevel: jest.fn().mockResolvedValue(0),
      deleteProbabilityLevel: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [RiskMatrixService, { provide: RiskMatrixRepository, useValue: repo }],
    }).compile();

    service = moduleRef.get(RiskMatrixService);
  });

  describe("createConfig", () => {
    it("cria a matriz inativa por padrão, mesmo se activate não for informado", async () => {
      repo.createConfig.mockResolvedValue({ id: "config-1", isActive: false });
      await service.createConfig("tenant-1", { name: "Matriz X", minApprovalScore: 3 });
      expect(repo.createConfig).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      expect(repo.activate).not.toHaveBeenCalled();
    });

    it("ativa a matriz recém-criada quando activate=true", async () => {
      repo.createConfig.mockResolvedValue({ id: "config-1", isActive: false });
      repo.activate.mockResolvedValue({ id: "config-1", isActive: true });
      await service.createConfig("tenant-1", {
        name: "Matriz X",
        minApprovalScore: 3,
        activate: true,
      });
      expect(repo.activate).toHaveBeenCalledWith("tenant-1", "config-1");
    });

    it("calcula a próxima versão como max(version)+1", async () => {
      repo.findAllForTenant.mockResolvedValue([{ version: 1 }, { version: 3 }]);
      repo.createConfig.mockResolvedValue({ id: "config-2" });
      await service.createConfig("tenant-1", { name: "Matriz Y", minApprovalScore: 3 });
      expect(repo.createConfig).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }));
    });
  });

  describe("activateConfig", () => {
    it("bloqueia ativação de matriz sem faixas/classificações configuradas", async () => {
      repo.findById.mockResolvedValue({
        id: "config-1",
        tenantId: "tenant-1",
        probabilityLevels: [],
        impactLevels: [{ id: "il-1" }],
        riskClassifications: [{ id: "rc-1" }],
      });
      await expect(service.activateConfig("tenant-1", "config-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.activate).not.toHaveBeenCalled();
    });

    it("ativa quando há ao menos uma faixa/classificação de cada tipo", async () => {
      repo.findById.mockResolvedValue({
        id: "config-1",
        tenantId: "tenant-1",
        probabilityLevels: [{ id: "pl-1" }],
        impactLevels: [{ id: "il-1" }],
        riskClassifications: [{ id: "rc-1" }],
      });
      repo.activate.mockResolvedValue({ id: "config-1", isActive: true });
      const result = await service.activateConfig("tenant-1", "config-1");
      expect(result.isActive).toBe(true);
    });

    it("bloqueia ativação de matriz de outro tenant", async () => {
      repo.findById.mockResolvedValue({ id: "config-1", tenantId: "outro-tenant" });
      await expect(service.activateConfig("tenant-1", "config-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("addProbabilityLevel", () => {
    it("rejeita minScore maior que maxScore", async () => {
      await expect(
        service.addProbabilityLevel("tenant-1", "config-1", {
          label: "Faixa invertida",
          minScore: 5,
          maxScore: 1,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.createProbabilityLevel).not.toHaveBeenCalled();
    });
  });

  describe("removeProbabilityLevel", () => {
    it("bloqueia remoção de faixa já usada em resultados de risco calculados", async () => {
      repo.findProbabilityLevelById.mockResolvedValue({
        id: "pl-1",
        riskMatrixConfigId: "config-1",
        riskMatrixConfig: { tenantId: "tenant-1" },
      });
      repo.countRiskResultsUsingProbabilityLevel.mockResolvedValue(2);
      await expect(service.removeProbabilityLevel("tenant-1", "pl-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.deleteProbabilityLevel).not.toHaveBeenCalled();
    });

    it("permite remoção de faixa sem uso", async () => {
      repo.findProbabilityLevelById.mockResolvedValue({
        id: "pl-1",
        riskMatrixConfigId: "config-1",
        riskMatrixConfig: { tenantId: "tenant-1" },
      });
      repo.countRiskResultsUsingProbabilityLevel.mockResolvedValue(0);
      await service.removeProbabilityLevel("tenant-1", "pl-1");
      expect(repo.deleteProbabilityLevel).toHaveBeenCalledWith("pl-1");
    });
  });
});
