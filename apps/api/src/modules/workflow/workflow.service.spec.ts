import { Test } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { WorkflowService } from "./workflow.service";
import { WorkflowRepository } from "./workflow.repository";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import { TechnicalOpinionService } from "../technical-opinions/technical-opinion.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { InventoryService } from "../inventory/inventory.service";
import { ITSM_ADAPTER } from "../integrations/itsm/itsm.interface";
import { COLLABORATION_ADAPTER } from "../integrations/collaboration/collaboration.interface";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "approver-1",
    tenantId: "tenant-1",
    email: "approver@example.com",
    name: "Aprovador",
    permissions: ["assessments:approve", "assessments:view-all"],
    ...overrides,
  };
}

const steps = [
  {
    id: "step-1",
    order: 1,
    name: "Gestor da Área",
    responsibleRoleId: "role-gestor",
    slaHours: 48,
    isOptional: false,
    requiresLgpd: false,
  },
  {
    id: "step-2",
    order: 2,
    name: "Segurança",
    responsibleRoleId: "role-seguranca",
    slaHours: 72,
    isOptional: false,
    requiresLgpd: false,
  },
  {
    id: "step-3",
    order: 3,
    name: "DPO",
    responsibleRoleId: "role-dpo",
    slaHours: 48,
    isOptional: false,
    requiresLgpd: true,
  },
  {
    id: "step-4",
    order: 4,
    name: "Jurídico",
    responsibleRoleId: "role-juridico",
    slaHours: 48,
    isOptional: true,
    requiresLgpd: false,
  },
  {
    id: "step-5",
    order: 5,
    name: "Aprovação Final",
    responsibleRoleId: "role-admin",
    slaHours: 24,
    isOptional: false,
    requiresLgpd: false,
  },
];

describe("WorkflowService", () => {
  let service: WorkflowService;
  let repo: {
    findActiveDefaultDefinition: jest.Mock;
    findInstanceByAssessmentId: jest.Mock;
    createInstance: jest.Mock;
    updateInstance: jest.Mock;
    createStepExecution: jest.Mock;
    countLgpdTriggers: jest.Mock;
    findStepExecutionById: jest.Mock;
    updateStepExecution: jest.Mock;
    findUserRoleIds: jest.Mock;
    findDefinitionById: jest.Mock;
    updateAssessmentStatus: jest.Mock;
    findAssessmentContext: jest.Mock;
    findPendingStepsForRoles: jest.Mock;
  };
  let technicalOpinionService: { generateForAssessment: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let notificationsService: { notify: jest.Mock; notifyRole: jest.Mock };
  let inventoryService: { createFromApprovedAssessment: jest.Mock };
  let itsmAdapter: { createTicket: jest.Mock };
  let collaborationAdapter: { postMessage: jest.Mock };

  beforeEach(async () => {
    repo = {
      findActiveDefaultDefinition: jest.fn(),
      findInstanceByAssessmentId: jest.fn(),
      createInstance: jest.fn(),
      updateInstance: jest.fn(),
      createStepExecution: jest.fn(),
      countLgpdTriggers: jest.fn().mockResolvedValue(0),
      findStepExecutionById: jest.fn(),
      updateStepExecution: jest.fn(),
      findUserRoleIds: jest.fn(),
      findDefinitionById: jest.fn(),
      updateAssessmentStatus: jest.fn(),
      findAssessmentContext: jest.fn().mockResolvedValue({ softwareName: "Sistema X" }),
      findPendingStepsForRoles: jest.fn(),
    };
    technicalOpinionService = { generateForAssessment: jest.fn().mockResolvedValue(undefined) };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
      notifyRole: jest.fn().mockResolvedValue(undefined),
    };
    inventoryService = { createFromApprovedAssessment: jest.fn().mockResolvedValue(undefined) };
    itsmAdapter = { createTicket: jest.fn().mockResolvedValue({ ticketId: "ticket-1" }) };
    collaborationAdapter = { postMessage: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: WorkflowRepository, useValue: repo },
        SeparationOfDutiesService,
        { provide: TechnicalOpinionService, useValue: technicalOpinionService },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: ITSM_ADAPTER, useValue: itsmAdapter },
        { provide: COLLABORATION_ADAPTER, useValue: collaborationAdapter },
      ],
    }).compile();

    service = moduleRef.get(WorkflowService);
  });

  describe("startWorkflow", () => {
    it("lança NotFoundException se não houver fluxo ativo/padrão configurado", async () => {
      repo.findActiveDefaultDefinition.mockResolvedValue(null);
      await expect(service.startWorkflow("tenant-1", "assessment-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lança UnprocessableEntityException se o fluxo não tiver etapas", async () => {
      repo.findActiveDefaultDefinition.mockResolvedValue({ id: "def-1", steps: [] });
      await expect(service.startWorkflow("tenant-1", "assessment-1")).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("pula a etapa DPO (requiresLgpd) quando a avaliação não envolve LGPD", async () => {
      repo.findActiveDefaultDefinition.mockResolvedValue({ id: "def-1", steps });
      repo.countLgpdTriggers.mockResolvedValue(0);
      repo.findInstanceByAssessmentId.mockResolvedValue(null);
      repo.createInstance.mockResolvedValue({ id: "instance-1" });

      await service.startWorkflow("tenant-1", "assessment-1");

      expect(repo.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({ currentStepOrder: 1 }),
      );
      expect(repo.createStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowStepId: "step-1",
          assessmentWorkflowInstanceId: "instance-1",
        }),
      );
    });

    it("reaproveita a instância existente (reenvio) em vez de criar outra", async () => {
      repo.findActiveDefaultDefinition.mockResolvedValue({ id: "def-1", steps });
      repo.countLgpdTriggers.mockResolvedValue(0);
      repo.findInstanceByAssessmentId.mockResolvedValue({ id: "instance-existente" });
      repo.updateInstance.mockResolvedValue({ id: "instance-existente" });

      await service.startWorkflow("tenant-1", "assessment-1");

      expect(repo.createInstance).not.toHaveBeenCalled();
      expect(repo.updateInstance).toHaveBeenCalledWith(
        "instance-existente",
        expect.objectContaining({ currentStepOrder: 1, status: "IN_PROGRESS" }),
      );
    });
  });

  describe("decideStep", () => {
    function makeExecution(overrides: Record<string, unknown> = {}) {
      return {
        id: "exec-1",
        status: "IN_PROGRESS",
        assessmentWorkflowInstanceId: "instance-1",
        workflowStep: {
          id: "step-1",
          order: 1,
          isOptional: false,
          responsibleRoleId: "role-gestor",
          responsibleRole: { name: "Gestor da Área" },
        },
        assessmentWorkflowInstance: {
          workflowDefinitionId: "def-1",
          assessment: {
            id: "assessment-1",
            tenantId: "tenant-1",
            requesterId: "requester-1",
            responsibleId: "responsible-1",
            softwareName: "Sistema X",
            vendor: "Fornecedor X",
            version: "1.0.0",
            url: null,
            areaId: "area-1",
            criticality: "MEDIUM",
            status: "IN_REVIEW",
          },
        },
        ...overrides,
      };
    }

    it("lança NotFoundException se a execução não existir", async () => {
      repo.findStepExecutionById.mockResolvedValue(null);
      await expect(
        service.decideStep(makeUser(), "exec-1", { decision: "APPROVE" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("lança ForbiddenException se a execução for de outro tenant", async () => {
      repo.findStepExecutionById.mockResolvedValue(
        makeExecution({
          assessmentWorkflowInstance: {
            workflowDefinitionId: "def-1",
            assessment: {
              id: "a1",
              tenantId: "outro-tenant",
              requesterId: "r1",
              status: "IN_REVIEW",
            },
          },
        }),
      );
      await expect(
        service.decideStep(makeUser(), "exec-1", { decision: "APPROVE" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lança BadRequestException se a etapa já não estiver IN_PROGRESS", async () => {
      repo.findStepExecutionById.mockResolvedValue(makeExecution({ status: "APPROVED" }));
      await expect(
        service.decideStep(makeUser(), "exec-1", { decision: "APPROVE" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("aplica Separação de Funções: solicitante não pode decidir a própria avaliação", async () => {
      repo.findStepExecutionById.mockResolvedValue(
        makeExecution({
          assessmentWorkflowInstance: {
            workflowDefinitionId: "def-1",
            assessment: {
              id: "a1",
              tenantId: "tenant-1",
              requesterId: "approver-1",
              status: "IN_REVIEW",
            },
          },
        }),
      );
      await expect(
        service.decideStep(makeUser({ id: "approver-1" }), "exec-1", { decision: "APPROVE" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lança ForbiddenException se o usuário não pertence ao papel responsável", async () => {
      repo.findStepExecutionById.mockResolvedValue(makeExecution());
      repo.findUserRoleIds.mockResolvedValue(["role-outro"]);
      await expect(
        service.decideStep(makeUser(), "exec-1", { decision: "APPROVE" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("bloqueia SKIP numa etapa que não é opcional", async () => {
      repo.findStepExecutionById.mockResolvedValue(makeExecution());
      repo.findUserRoleIds.mockResolvedValue(["role-gestor"]);
      await expect(service.decideStep(makeUser(), "exec-1", { decision: "SKIP" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("REJECT encerra a instância e reprova a avaliação", async () => {
      repo.findStepExecutionById
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeExecution({ status: "REJECTED" }));
      repo.findUserRoleIds.mockResolvedValue(["role-gestor"]);

      await service.decideStep(makeUser(), "exec-1", { decision: "REJECT" });

      expect(repo.updateInstance).toHaveBeenCalledWith("instance-1", { status: "REJECTED" });
      expect(repo.updateAssessmentStatus).toHaveBeenCalledWith("assessment-1", "REJECTED");
      expect(technicalOpinionService.generateForAssessment).toHaveBeenCalledWith(
        "tenant-1",
        "assessment-1",
        "REJECTED",
        "approver-1",
      );
      expect(itsmAdapter.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-1", externalReference: "assessment-1" }),
      );
    });

    it("REQUEST_ADJUSTMENT devolve a avaliação sem fechar a instância", async () => {
      repo.findStepExecutionById
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeExecution({ status: "ADJUSTMENT_REQUESTED" }));
      repo.findUserRoleIds.mockResolvedValue(["role-gestor"]);

      await service.decideStep(makeUser(), "exec-1", { decision: "REQUEST_ADJUSTMENT" });

      expect(repo.updateAssessmentStatus).toHaveBeenCalledWith(
        "assessment-1",
        "PENDING_ADJUSTMENT",
      );
      expect(repo.updateInstance).not.toHaveBeenCalled();
    });

    it("APPROVE avança para a próxima etapa elegível, pulando o DPO sem LGPD", async () => {
      repo.findStepExecutionById
        .mockResolvedValueOnce(makeExecution())
        .mockResolvedValueOnce(makeExecution({ status: "APPROVED" }));
      repo.findUserRoleIds.mockResolvedValue(["role-gestor"]);
      repo.findDefinitionById.mockResolvedValue({ id: "def-1", steps });
      repo.countLgpdTriggers.mockResolvedValue(0);

      await service.decideStep(makeUser(), "exec-1", { decision: "APPROVE" });

      expect(repo.updateInstance).toHaveBeenCalledWith("instance-1", { currentStepOrder: 2 });
      expect(repo.createStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({ workflowStepId: "step-2" }),
      );
      expect(repo.updateAssessmentStatus).not.toHaveBeenCalled();
    });

    it("APPROVE na última etapa elegível aprova a avaliação inteira", async () => {
      repo.findStepExecutionById
        .mockResolvedValueOnce(
          makeExecution({
            workflowStep: {
              id: "step-5",
              order: 5,
              isOptional: false,
              responsibleRoleId: "role-admin",
              responsibleRole: { name: "Aprovação Final" },
            },
          }),
        )
        .mockResolvedValueOnce(makeExecution({ status: "APPROVED" }));
      repo.findUserRoleIds.mockResolvedValue(["role-admin"]);
      repo.findDefinitionById.mockResolvedValue({ id: "def-1", steps });
      repo.countLgpdTriggers.mockResolvedValue(0);

      await service.decideStep(makeUser(), "exec-1", { decision: "APPROVE" });

      expect(repo.updateInstance).toHaveBeenCalledWith("instance-1", { status: "APPROVED" });
      expect(repo.updateAssessmentStatus).toHaveBeenCalledWith("assessment-1", "APPROVED");
      expect(repo.createStepExecution).not.toHaveBeenCalled();
      expect(technicalOpinionService.generateForAssessment).toHaveBeenCalledWith(
        "tenant-1",
        "assessment-1",
        "APPROVED",
        "approver-1",
      );
      expect(collaborationAdapter.postMessage).not.toHaveBeenCalled();
    });

    it("APPROVE final de avaliação CRITICAL posta alerta no canal de colaboração", async () => {
      repo.findStepExecutionById
        .mockResolvedValueOnce(
          makeExecution({
            workflowStep: {
              id: "step-5",
              order: 5,
              isOptional: false,
              responsibleRoleId: "role-admin",
              responsibleRole: { name: "Aprovação Final" },
            },
            assessmentWorkflowInstance: {
              workflowDefinitionId: "def-1",
              assessment: {
                id: "assessment-1",
                tenantId: "tenant-1",
                requesterId: "requester-1",
                responsibleId: "responsible-1",
                softwareName: "Sistema Crítico",
                vendor: "Fornecedor X",
                version: "1.0.0",
                url: null,
                areaId: "area-1",
                criticality: "CRITICAL",
                status: "IN_REVIEW",
              },
            },
          }),
        )
        .mockResolvedValueOnce(makeExecution({ status: "APPROVED" }));
      repo.findUserRoleIds.mockResolvedValue(["role-admin"]);
      repo.findDefinitionById.mockResolvedValue({ id: "def-1", steps });
      repo.countLgpdTriggers.mockResolvedValue(0);

      await service.decideStep(makeUser(), "exec-1", { decision: "APPROVE" });

      expect(collaborationAdapter.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "security-alerts" }),
      );
    });

    it("SKIP numa etapa opcional avança normalmente", async () => {
      repo.findStepExecutionById
        .mockResolvedValueOnce(
          makeExecution({
            workflowStep: {
              id: "step-4",
              order: 4,
              isOptional: true,
              responsibleRoleId: "role-juridico",
              responsibleRole: { name: "Jurídico" },
            },
          }),
        )
        .mockResolvedValueOnce(makeExecution({ status: "SKIPPED" }));
      repo.findUserRoleIds.mockResolvedValue(["role-juridico"]);
      repo.findDefinitionById.mockResolvedValue({ id: "def-1", steps });
      repo.countLgpdTriggers.mockResolvedValue(0);

      await service.decideStep(makeUser(), "exec-1", { decision: "SKIP" });

      expect(repo.createStepExecution).toHaveBeenCalledWith(
        expect.objectContaining({ workflowStepId: "step-5" }),
      );
    });
  });
});
