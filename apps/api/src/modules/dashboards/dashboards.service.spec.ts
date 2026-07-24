import { Test } from "@nestjs/testing";
import { DashboardsService } from "./dashboards.service";
import { DashboardsRepository } from "./dashboards.repository";
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

function makeOpinion(
  areaId: string,
  status: "APPROVED" | "REJECTED",
  totalScore: number | null,
  classificationLabel = status === "APPROVED" ? "Homologado" : "Rejeitado",
) {
  return {
    classificationLabel,
    assessmentVersion: {
      riskResult: totalScore === null ? null : { totalScore },
      assessment: { areaId, status },
    },
  };
}

describe("DashboardsService", () => {
  let service: DashboardsService;
  let repo: {
    countAssessmentsByStatus: jest.Mock;
    countMyAssessmentsByStatus: jest.Mock;
    findRecentForUser: jest.Mock;
    countPendingStepsByStep: jest.Mock;
    findStepsByIds: jest.Mock;
    countSlaBreaches: jest.Mock;
    findTerminalOpinions: jest.Mock;
    findAllActiveAreas: jest.Mock;
    countSubmittedByArea: jest.Mock;
    countBlockedAreas: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      countAssessmentsByStatus: jest.fn(),
      countMyAssessmentsByStatus: jest.fn(),
      findRecentForUser: jest.fn(),
      countPendingStepsByStep: jest.fn(),
      findStepsByIds: jest.fn(),
      countSlaBreaches: jest.fn(),
      findTerminalOpinions: jest.fn(),
      findAllActiveAreas: jest.fn(),
      countSubmittedByArea: jest.fn(),
      countBlockedAreas: jest.fn().mockResolvedValue(0),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [DashboardsService, { provide: DashboardsRepository, useValue: repo }],
    }).compile();

    service = moduleRef.get(DashboardsService);
  });

  describe("getUserDashboard", () => {
    it("converte a contagem por status num mapa e devolve as avaliações recentes", async () => {
      repo.countMyAssessmentsByStatus.mockResolvedValue([
        { status: "DRAFT", _count: 2 },
        { status: "APPROVED", _count: 1 },
      ]);
      repo.findRecentForUser.mockResolvedValue([{ id: "a1", softwareName: "X" }]);

      const result = await service.getUserDashboard(makeUser());

      expect(result.assessmentsByStatus).toEqual({ DRAFT: 2, APPROVED: 1 });
      expect(result.recentAssessments).toHaveLength(1);
    });
  });

  describe("getAdminDashboard", () => {
    it("resolve o nome de cada etapa pendente", async () => {
      repo.countAssessmentsByStatus.mockResolvedValue([{ status: "IN_REVIEW", _count: 3 }]);
      repo.countPendingStepsByStep.mockResolvedValue([
        { workflowStepId: "step-1", _count: 2 },
        { workflowStepId: "step-2", _count: 1 },
      ]);
      repo.findStepsByIds.mockResolvedValue([
        { id: "step-1", name: "Gestor da Área" },
        { id: "step-2", name: "Segurança da Informação" },
      ]);
      repo.countSlaBreaches.mockResolvedValue(1);
      repo.countBlockedAreas.mockResolvedValue(2);

      const result = await service.getAdminDashboard("tenant-1");

      expect(result.pendingByStep).toEqual([
        { stepName: "Gestor da Área", count: 2 },
        { stepName: "Segurança da Informação", count: 1 },
      ]);
      expect(result.slaBreaches).toBe(1);
      expect(result.blockedAreasCount).toBe(2);
      expect(repo.findStepsByIds).toHaveBeenCalledWith(["step-1", "step-2"]);
    });

    it("não consulta nomes de etapa quando não há nenhuma pendente", async () => {
      repo.countAssessmentsByStatus.mockResolvedValue([]);
      repo.countPendingStepsByStep.mockResolvedValue([]);
      repo.countSlaBreaches.mockResolvedValue(0);

      await service.getAdminDashboard("tenant-1");

      expect(repo.findStepsByIds).not.toHaveBeenCalled();
    });
  });

  describe("getExecutiveDashboard", () => {
    it("calcula taxa de aprovação e distribuição de classificação", async () => {
      repo.findTerminalOpinions.mockResolvedValue([
        makeOpinion("area-1", "APPROVED", 4.5),
        makeOpinion("area-1", "APPROVED", 4.0),
        makeOpinion("area-2", "REJECTED", 1.0),
      ]);

      const result = await service.getExecutiveDashboard("tenant-1");

      expect(result.totalDecided).toBe(3);
      expect(result.approved).toBe(2);
      expect(result.rejected).toBe(1);
      expect(result.approvalRate).toBeCloseTo(2 / 3);
      expect(result.classificationDistribution).toEqual({ Homologado: 2, Rejeitado: 1 });
    });

    it("não divide por zero quando não há nada decidido ainda", async () => {
      repo.findTerminalOpinions.mockResolvedValue([]);
      const result = await service.getExecutiveDashboard("tenant-1");
      expect(result.approvalRate).toBe(0);
    });
  });

  describe("getAreaLeaderboard", () => {
    it("calcula volume/qualidade/aprovação e o score composto, ordenado do maior pro menor", async () => {
      repo.findAllActiveAreas.mockResolvedValue([
        { id: "area-1", name: "TI" },
        { id: "area-2", name: "Financeiro" },
      ]);
      // area-1: volume 10 (máximo); area-2: volume 5 (metade do máximo)
      repo.countSubmittedByArea.mockResolvedValue([
        { areaId: "area-1", _count: 10 },
        { areaId: "area-2", _count: 5 },
      ]);
      repo.findTerminalOpinions.mockResolvedValue([
        // area-1: score médio 5, 100% aprovado -> volumeScore 5, qualityScore 5, approvalScore 5 -> composite 5
        makeOpinion("area-1", "APPROVED", 5),
        makeOpinion("area-1", "APPROVED", 5),
        // area-2: score médio 0, 0% aprovado -> volumeScore 2.5, qualityScore 0, approvalScore 0
        makeOpinion("area-2", "REJECTED", 0),
      ]);

      const result = await service.getAreaLeaderboard("tenant-1");

      expect(result[0]).toMatchObject({
        areaId: "area-1",
        volume: 10,
        qualityScore: 5,
        approvalRate: 1,
        compositeScore: 5,
        level: "Referência",
      });
      expect(result[1]).toMatchObject({
        areaId: "area-2",
        volume: 5,
        qualityScore: 0,
        approvalRate: 0,
        // compositeScore = volumeScore(2.5)*0.3 = 0.75
        compositeScore: 0.75,
        level: "Iniciante",
      });
      // ordenado do maior pro menor
      expect(result[0]!.compositeScore).toBeGreaterThan(result[1]!.compositeScore);
    });

    it("área sem nenhuma submissão fica com score zero e nível Iniciante", async () => {
      repo.findAllActiveAreas.mockResolvedValue([{ id: "area-1", name: "TI" }]);
      repo.countSubmittedByArea.mockResolvedValue([]);
      repo.findTerminalOpinions.mockResolvedValue([]);

      const result = await service.getAreaLeaderboard("tenant-1");

      expect(result[0]).toMatchObject({
        volume: 0,
        qualityScore: 0,
        approvalRate: 0,
        level: "Iniciante",
      });
    });

    it("ignora pareceres de áreas que não estão mais ativas", async () => {
      repo.findAllActiveAreas.mockResolvedValue([{ id: "area-1", name: "TI" }]);
      repo.countSubmittedByArea.mockResolvedValue([{ areaId: "area-1", _count: 1 }]);
      repo.findTerminalOpinions.mockResolvedValue([
        makeOpinion("area-1", "APPROVED", 5),
        makeOpinion("area-removida", "APPROVED", 5),
      ]);

      const result = await service.getAreaLeaderboard("tenant-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.areaId).toBe("area-1");
    });
  });
});
