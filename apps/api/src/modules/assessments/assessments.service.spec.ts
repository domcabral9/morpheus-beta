import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AssessmentsService } from "./assessments.service";
import { AssessmentsRepository, AssessmentDetail } from "./assessments.repository";
import { AreasService } from "../areas/areas.service";
import { UsersService } from "../users/users.service";
import { QuestionnaireService } from "../questionnaire/questionnaire.service";
import { RiskEvaluationService } from "../risk-engine/risk-evaluation.service";
import { WorkflowService } from "../workflow/workflow.service";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-requester",
    tenantId: "tenant-1",
    homeTenantId: "tenant-1",
    email: "req@example.com",
    name: "Requester",
    permissions: [
      "assessments:create",
      "assessments:edit-own",
      "assessments:view-own",
      "assessments:submit",
    ],
    isSuperAdmin: false,
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<AssessmentDetail> = {}): AssessmentDetail {
  return {
    id: "assessment-1",
    tenantId: "tenant-1",
    softwareName: "Sistema X",
    vendor: "Fornecedor X",
    version: null,
    url: null,
    responsibleId: "user-requester",
    responsible: { id: "user-requester", name: "Requester", email: "req@example.com" },
    areaId: "area-1",
    area: { id: "area-1", tenantId: "tenant-1", name: "TI", isActive: true } as never,
    criticality: "MEDIUM",
    justification: "Justificativa",
    requesterId: "user-requester",
    requester: { id: "user-requester", name: "Requester", email: "req@example.com" },
    status: "DRAFT",
    createdAt: new Date(),
    updatedAt: new Date(),
    versions: [],
    ...overrides,
  } as unknown as AssessmentDetail;
}

describe("AssessmentsService", () => {
  let service: AssessmentsService;
  let repo: {
    create: jest.Mock;
    findById: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    upsertAnswers: jest.Mock;
    findAnswers: jest.Mock;
    countVersions: jest.Mock;
    createVersion: jest.Mock;
    findVersionsWithDetails: jest.Mock;
  };
  let areasService: { findAllActive: jest.Mock };
  let usersService: { findById: jest.Mock };
  let questionnaireService: { getCategories: jest.Mock };
  let riskEvaluationService: { evaluate: jest.Mock };
  let workflowService: { startWorkflow: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsertAnswers: jest.fn(),
      findAnswers: jest.fn().mockResolvedValue([]),
      countVersions: jest.fn().mockResolvedValue(0),
      createVersion: jest.fn().mockResolvedValue({ id: "version-1" }),
      findVersionsWithDetails: jest.fn().mockResolvedValue([]),
    };
    areasService = { findAllActive: jest.fn().mockResolvedValue([{ id: "area-1" }]) };
    usersService = {
      findById: jest.fn().mockResolvedValue({ id: "user-requester", tenantId: "tenant-1" }),
    };
    questionnaireService = { getCategories: jest.fn().mockResolvedValue([]) };
    riskEvaluationService = { evaluate: jest.fn().mockResolvedValue({ id: "risk-result-1" }) };
    workflowService = { startWorkflow: jest.fn().mockResolvedValue(undefined) };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: AssessmentsRepository, useValue: repo },
        { provide: AreasService, useValue: areasService },
        { provide: UsersService, useValue: usersService },
        { provide: QuestionnaireService, useValue: questionnaireService },
        { provide: RiskEvaluationService, useValue: riskEvaluationService },
        { provide: WorkflowService, useValue: workflowService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(AssessmentsService);
  });

  describe("findOneForUser (SoD / visibilidade)", () => {
    it("dono com view-own consegue ver a própria avaliação", async () => {
      repo.findById.mockResolvedValue(makeAssessment());
      const result = await service.findOneForUser(makeUser(), "assessment-1");
      expect(result.id).toBe("assessment-1");
    });

    it("outro usuário sem view-all NÃO consegue ver avaliação de terceiro", async () => {
      repo.findById.mockResolvedValue(makeAssessment({ requesterId: "outro-user" } as never));
      await expect(service.findOneForUser(makeUser(), "assessment-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("usuário com view-all consegue ver avaliação de terceiro", async () => {
      repo.findById.mockResolvedValue(makeAssessment({ requesterId: "outro-user" } as never));
      const admin = makeUser({ permissions: ["assessments:view-all"] });
      const result = await service.findOneForUser(admin, "assessment-1");
      expect(result.id).toBe("assessment-1");
    });
  });

  describe("update (edição enquanto aberta)", () => {
    it("bloqueia edição por quem não é o solicitante", async () => {
      repo.findById.mockResolvedValue(makeAssessment({ requesterId: "outro-user" } as never));
      await expect(
        service.update(makeUser(), "assessment-1", { softwareName: "Novo nome" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("bloqueia edição quando a avaliação já não está mais aberta", async () => {
      repo.findById.mockResolvedValue(makeAssessment({ status: "APPROVED" } as never));
      await expect(
        service.update(makeUser(), "assessment-1", { softwareName: "Novo nome" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("permite edição pelo dono enquanto DRAFT", async () => {
      repo.findById.mockResolvedValue(makeAssessment());
      repo.update.mockResolvedValue(makeAssessment({ softwareName: "Novo nome" } as never));
      const result = await service.update(makeUser(), "assessment-1", {
        softwareName: "Novo nome",
      });
      expect(result.softwareName).toBe("Novo nome");
    });
  });

  describe("submit (Separação de Funções + completude)", () => {
    it("bloqueia envio por quem não é o solicitante (SoD)", async () => {
      repo.findById.mockResolvedValue(makeAssessment({ requesterId: "outro-user" } as never));
      await expect(service.submit(makeUser(), "assessment-1")).rejects.toThrow(ForbiddenException);
    });

    it("bloqueia envio se houver pergunta obrigatória sem resposta", async () => {
      repo.findById.mockResolvedValue(makeAssessment());
      questionnaireService.getCategories.mockResolvedValue([
        {
          questions: [{ id: "q1", text: "Pergunta obrigatória", type: "TEXT", isRequired: true }],
        },
      ]);
      repo.findAnswers.mockResolvedValue([]);

      await expect(service.submit(makeUser(), "assessment-1")).rejects.toThrow(BadRequestException);
      expect(repo.createVersion).not.toHaveBeenCalled();
    });

    it("ignora pergunta condicional (isRequired=false) sem resposta", async () => {
      repo.findById.mockResolvedValue(makeAssessment());
      questionnaireService.getCategories.mockResolvedValue([
        {
          questions: [{ id: "q1", text: "Pergunta condicional", type: "TEXT", isRequired: false }],
        },
      ]);
      repo.findAnswers.mockResolvedValue([]);
      repo.update.mockResolvedValue(makeAssessment({ status: "IN_REVIEW" } as never));

      const result = await service.submit(makeUser(), "assessment-1");
      expect(result.status).toBe("IN_REVIEW");
      expect(repo.createVersion).toHaveBeenCalledTimes(1);
      expect(repo.update).toHaveBeenLastCalledWith("assessment-1", { status: "IN_REVIEW" });
    });

    it("inicia o workflow de aprovação antes de marcar a avaliação como IN_REVIEW", async () => {
      repo.findById.mockResolvedValue(makeAssessment());
      repo.findAnswers.mockResolvedValue([]);
      repo.update.mockResolvedValue(makeAssessment({ status: "IN_REVIEW" } as never));

      await service.submit(makeUser(), "assessment-1");

      expect(workflowService.startWorkflow).toHaveBeenCalledWith("tenant-1", "assessment-1");
    });

    it("cria a versão v1.0 no primeiro envio e v1.1 no reenvio após ajuste", async () => {
      repo.update.mockResolvedValue(makeAssessment({ status: "IN_REVIEW" } as never));

      repo.findById.mockResolvedValue(makeAssessment());
      repo.countVersions.mockResolvedValue(0);
      await service.submit(makeUser(), "assessment-1");
      expect(repo.createVersion).toHaveBeenLastCalledWith(
        expect.objectContaining({ versionLabel: "v1.0" }),
      );

      repo.findById.mockResolvedValue(makeAssessment({ status: "PENDING_ADJUSTMENT" } as never));
      repo.countVersions.mockResolvedValue(1);
      await service.submit(makeUser(), "assessment-1");
      expect(repo.createVersion).toHaveBeenLastCalledWith(
        expect.objectContaining({ versionLabel: "v1.1", changeReason: "Reenvio após ajuste" }),
      );
    });

    it("aciona o motor de risco com a versão recém-criada e as respostas pontuáveis", async () => {
      repo.findById.mockResolvedValue(makeAssessment());
      repo.update.mockResolvedValue(makeAssessment({ status: "IN_REVIEW" } as never));
      questionnaireService.getCategories.mockResolvedValue([
        {
          questions: [
            {
              id: "q-text",
              text: "Descreva o uso",
              type: "TEXT",
              isRequired: false,
              weight: 1,
              riskDimension: "BOTH",
            },
            {
              id: "q-scale",
              text: "Nível de exposição",
              type: "SCALE",
              isRequired: false,
              weight: 2,
              riskDimension: "IMPACT",
            },
            {
              id: "q-choice",
              text: "Possui MFA?",
              type: "SINGLE_CHOICE",
              isRequired: false,
              weight: 3,
              riskDimension: "PROBABILITY",
            },
          ],
        },
      ]);
      repo.findAnswers.mockResolvedValue([
        { questionId: "q-text", textValue: "Uso interno", scaleValue: null, selectedOptions: [] },
        { questionId: "q-scale", textValue: null, scaleValue: 4, selectedOptions: [] },
        {
          questionId: "q-choice",
          textValue: null,
          scaleValue: null,
          selectedOptions: [{ questionOptionId: "opt-1", questionOption: { score: 1 } }],
        },
      ]);

      await service.submit(makeUser(), "assessment-1");

      expect(riskEvaluationService.evaluate).toHaveBeenCalledWith(
        "tenant-1",
        "version-1",
        expect.arrayContaining([
          { riskDimension: "IMPACT", weight: 2, score: 4 },
          { riskDimension: "PROBABILITY", weight: 3, score: 1 },
        ]),
      );
      // A pergunta TEXT não entra no motor de risco (sem score numérico).
      const scorable = riskEvaluationService.evaluate.mock.calls[0][2];
      expect(scorable).toHaveLength(2);
    });

    it("grava um log de auditoria SUBMIT após o envio", async () => {
      repo.findById.mockResolvedValue(makeAssessment());
      repo.findAnswers.mockResolvedValue([]);
      repo.update.mockResolvedValue(makeAssessment({ status: "IN_REVIEW" } as never));

      await service.submit(makeUser(), "assessment-1");

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-requester",
          action: "SUBMIT",
          entityType: "Assessment",
          entityId: "assessment-1",
        }),
      );
    });
  });

  describe("getVersionHistory", () => {
    it("bloqueia quem não pode visualizar a avaliação", async () => {
      repo.findById.mockResolvedValue(makeAssessment({ requesterId: "outro-user" } as never));
      await expect(service.getVersionHistory(makeUser(), "assessment-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("devolve a linha do tempo de versões para quem pode visualizar", async () => {
      repo.findById.mockResolvedValue(makeAssessment());
      repo.findVersionsWithDetails.mockResolvedValue([
        { id: "v1", versionLabel: "v1.0", riskResult: null, technicalOpinion: null },
      ]);

      const result = await service.getVersionHistory(makeUser(), "assessment-1");

      expect(result).toHaveLength(1);
      expect(repo.findVersionsWithDetails).toHaveBeenCalledWith("assessment-1");
    });
  });
});
