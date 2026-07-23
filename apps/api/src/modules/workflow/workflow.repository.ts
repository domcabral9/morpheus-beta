import { Injectable } from "@nestjs/common";
import { AssessmentStatus, Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const definitionWithStepsInclude = {
  steps: { orderBy: { order: "asc" } },
} satisfies Prisma.WorkflowDefinitionInclude;

export type WorkflowDefinitionWithSteps = Prisma.WorkflowDefinitionGetPayload<{
  include: typeof definitionWithStepsInclude;
}>;

const instanceDetailInclude = {
  workflowDefinition: { include: { steps: { orderBy: { order: "asc" } } } },
  stepExecutions: {
    include: {
      workflowStep: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.AssessmentWorkflowInstanceInclude;

export type WorkflowInstanceDetail = Prisma.AssessmentWorkflowInstanceGetPayload<{
  include: typeof instanceDetailInclude;
}>;

const stepExecutionDetailInclude = {
  workflowStep: { include: { responsibleRole: true } },
  assessmentWorkflowInstance: {
    include: {
      assessment: {
        select: {
          id: true,
          tenantId: true,
          requesterId: true,
          responsibleId: true,
          softwareName: true,
          vendor: true,
          version: true,
          url: true,
          areaId: true,
          criticality: true,
          status: true,
          hasRiskAnalysis: true,
          hasInfoSecClause: true,
        },
      },
    },
  },
} satisfies Prisma.WorkflowStepExecutionInclude;

export type StepExecutionDetail = Prisma.WorkflowStepExecutionGetPayload<{
  include: typeof stepExecutionDetailInclude;
}>;

@Injectable()
export class WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Definições -----------------------------------------------------------------
  findAllDefinitions(tenantId: string): Promise<WorkflowDefinitionWithSteps[]> {
    return this.prisma.workflowDefinition.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: definitionWithStepsInclude,
    });
  }

  findDefinitionById(id: string): Promise<WorkflowDefinitionWithSteps | null> {
    return this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: definitionWithStepsInclude,
    });
  }

  findActiveDefaultDefinition(tenantId: string): Promise<WorkflowDefinitionWithSteps | null> {
    return this.prisma.workflowDefinition.findFirst({
      where: { tenantId, isActive: true, isDefault: true },
      include: definitionWithStepsInclude,
    });
  }

  createDefinition(
    data: Prisma.WorkflowDefinitionUncheckedCreateInput,
  ): Promise<WorkflowDefinitionWithSteps> {
    return this.prisma.workflowDefinition.create({ data, include: definitionWithStepsInclude });
  }

  updateDefinition(
    id: string,
    data: Prisma.WorkflowDefinitionUncheckedUpdateInput,
  ): Promise<WorkflowDefinitionWithSteps> {
    return this.prisma.workflowDefinition.update({
      where: { id },
      data,
      include: definitionWithStepsInclude,
    });
  }

  setDefault(tenantId: string, id: string): Promise<WorkflowDefinitionWithSteps> {
    return this.prisma.$transaction(async (tx) => {
      await tx.workflowDefinition.updateMany({
        where: { tenantId, id: { not: id } },
        data: { isDefault: false },
      });
      return tx.workflowDefinition.update({
        where: { id },
        data: { isDefault: true },
        include: definitionWithStepsInclude,
      });
    });
  }

  // --- Etapas -----------------------------------------------------------------------
  createStep(data: Prisma.WorkflowStepUncheckedCreateInput) {
    return this.prisma.workflowStep.create({ data });
  }

  findStepById(id: string) {
    return this.prisma.workflowStep.findUnique({
      where: { id },
      include: { workflowDefinition: true },
    });
  }

  updateStep(id: string, data: Prisma.WorkflowStepUncheckedUpdateInput) {
    return this.prisma.workflowStep.update({ where: { id }, data });
  }

  deleteStep(id: string) {
    return this.prisma.workflowStep.delete({ where: { id } });
  }

  countExecutionsUsingStep(stepId: string): Promise<number> {
    return this.prisma.workflowStepExecution.count({ where: { workflowStepId: stepId } });
  }

  // --- Instâncias --------------------------------------------------------------------
  findInstanceByAssessmentId(assessmentId: string): Promise<WorkflowInstanceDetail | null> {
    return this.prisma.assessmentWorkflowInstance.findUnique({
      where: { assessmentId },
      include: instanceDetailInclude,
    });
  }

  createInstance(data: Prisma.AssessmentWorkflowInstanceUncheckedCreateInput) {
    return this.prisma.assessmentWorkflowInstance.create({ data });
  }

  updateInstance(id: string, data: Prisma.AssessmentWorkflowInstanceUncheckedUpdateInput) {
    return this.prisma.assessmentWorkflowInstance.update({ where: { id }, data });
  }

  // --- Execuções de etapa --------------------------------------------------------------
  createStepExecution(data: Prisma.WorkflowStepExecutionUncheckedCreateInput) {
    return this.prisma.workflowStepExecution.create({ data });
  }

  updateStepExecution(id: string, data: Prisma.WorkflowStepExecutionUncheckedUpdateInput) {
    return this.prisma.workflowStepExecution.update({ where: { id }, data });
  }

  findStepExecutionById(id: string): Promise<StepExecutionDetail | null> {
    return this.prisma.workflowStepExecution.findUnique({
      where: { id },
      include: stepExecutionDetailInclude,
    });
  }

  // --- Leituras auxiliares (autorização / roteamento condicional) ----------------------
  findAssessmentContext(assessmentId: string) {
    return this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, tenantId: true, requesterId: true, softwareName: true, status: true },
    });
  }

  updateAssessmentStatus(assessmentId: string, status: AssessmentStatus) {
    return this.prisma.assessment.update({ where: { id: assessmentId }, data: { status } });
  }

  /** Quantas respostas desta avaliação selecionaram uma opção marcada como gatilho de LGPD. */
  countLgpdTriggers(assessmentId: string): Promise<number> {
    return this.prisma.assessmentAnswerOption.count({
      where: {
        questionOption: { triggersLgpdReview: true },
        assessmentAnswer: { assessmentId },
      },
    });
  }

  async findUserRoleIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    return rows.map((row) => row.roleId);
  }

  findPendingStepsForRoles(tenantId: string, roleIds: string[]) {
    return this.prisma.workflowStepExecution.findMany({
      where: {
        status: "IN_PROGRESS",
        workflowStep: { responsibleRoleId: { in: roleIds } },
        assessmentWorkflowInstance: { assessment: { tenantId } },
      },
      include: {
        workflowStep: true,
        assessmentWorkflowInstance: {
          include: {
            assessment: {
              select: {
                id: true,
                softwareName: true,
                vendor: true,
                criticality: true,
                requesterId: true,
                hasRiskAnalysis: true,
                hasInfoSecClause: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}
