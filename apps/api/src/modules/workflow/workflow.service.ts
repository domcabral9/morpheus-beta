import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { WorkflowStep, WorkflowStepStatus } from "@morpheus/database";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import {
  WorkflowRepository,
  WorkflowDefinitionWithSteps,
  WorkflowInstanceDetail,
  StepExecutionDetail,
} from "./workflow.repository";
import { CreateWorkflowDefinitionDto } from "./dto/create-definition.dto";
import { UpdateWorkflowDefinitionDto } from "./dto/update-definition.dto";
import { CreateStepDto } from "./dto/create-step.dto";
import { UpdateStepDto } from "./dto/update-step.dto";
import { DecideStepDto } from "./dto/decide-step.dto";

const DECISION_TO_STATUS: Record<DecideStepDto["decision"], WorkflowStepStatus> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  REQUEST_ADJUSTMENT: "ADJUSTMENT_REQUESTED",
  SKIP: "SKIPPED",
};

/**
 * Motor de workflow configurável (Etapa 6). A definição (etapas, papel
 * responsável, SLA, opcional/condicional-LGPD) é dado, não código — o motor
 * só sabe avançar/decidir contra o que estiver cadastrado em
 * WorkflowDefinition/WorkflowStep, mesmo espírito do motor de risco (Etapa 5).
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly separationOfDutiesService: SeparationOfDutiesService,
  ) {}

  /**
   * Inicia (ou reinicia, em caso de reenvio após ajuste) o fluxo de aprovação
   * de uma avaliação recém-submetida. Reaproveita a mesma instância 1:1 em
   * vez de criar outra — reenvios voltam para a primeira etapa elegível,
   * preservando o histórico das execuções anteriores (nenhuma é apagada).
   */
  async startWorkflow(tenantId: string, assessmentId: string): Promise<void> {
    const definition = await this.workflowRepository.findActiveDefaultDefinition(tenantId);
    if (!definition) {
      throw new NotFoundException(
        "Nenhum fluxo de aprovação ativo (padrão) configurado para este tenant.",
      );
    }
    if (definition.steps.length === 0) {
      throw new UnprocessableEntityException(
        "O fluxo de aprovação ativo não tem etapas configuradas.",
      );
    }

    const involvesLgpd = (await this.workflowRepository.countLgpdTriggers(assessmentId)) > 0;
    const firstStep = this.firstEligibleStep(definition.steps, involvesLgpd);
    if (!firstStep) {
      throw new UnprocessableEntityException(
        "Nenhuma etapa elegível encontrada no fluxo de aprovação ativo.",
      );
    }

    const existingInstance = await this.workflowRepository.findInstanceByAssessmentId(assessmentId);
    const instanceId = existingInstance
      ? (
          await this.workflowRepository.updateInstance(existingInstance.id, {
            workflowDefinitionId: definition.id,
            currentStepOrder: firstStep.order,
            status: "IN_PROGRESS",
          })
        ).id
      : (
          await this.workflowRepository.createInstance({
            assessmentId,
            workflowDefinitionId: definition.id,
            currentStepOrder: firstStep.order,
            status: "IN_PROGRESS",
          })
        ).id;

    await this.workflowRepository.createStepExecution({
      assessmentWorkflowInstanceId: instanceId,
      workflowStepId: firstStep.id,
      status: "IN_PROGRESS",
      slaDueAt: this.computeSlaDueAt(firstStep.slaHours),
    });
  }

  async decideStep(
    user: AuthenticatedUser,
    stepExecutionId: string,
    dto: DecideStepDto,
  ): Promise<StepExecutionDetail> {
    const execution = await this.workflowRepository.findStepExecutionById(stepExecutionId);
    if (!execution) throw new NotFoundException("Etapa de workflow não encontrada.");

    const assessment = execution.assessmentWorkflowInstance.assessment;
    if (assessment.tenantId !== user.tenantId) {
      throw new ForbiddenException("Etapa de outro tenant.");
    }
    if (execution.status !== "IN_PROGRESS") {
      throw new BadRequestException("Esta etapa já foi decidida ou não está mais ativa.");
    }

    this.separationOfDutiesService.assertNotSelfApproval(
      assessment.requesterId,
      user.id,
      "decidir",
    );

    const hasRole = await this.userHasRole(user.id, execution.workflowStep.responsibleRoleId);
    if (!hasRole) {
      throw new ForbiddenException(
        `Você não pertence ao papel responsável por esta etapa (${execution.workflowStep.responsibleRole.name}).`,
      );
    }

    if (dto.decision === "SKIP" && !execution.workflowStep.isOptional) {
      throw new BadRequestException("Esta etapa não é opcional e não pode ser pulada.");
    }

    await this.workflowRepository.updateStepExecution(execution.id, {
      status: DECISION_TO_STATUS[dto.decision],
      comments: dto.comments,
      decidedById: user.id,
      decidedAt: new Date(),
    });

    if (dto.decision === "REJECT") {
      await this.workflowRepository.updateInstance(execution.assessmentWorkflowInstanceId, {
        status: "REJECTED",
      });
      await this.workflowRepository.updateAssessmentStatus(assessment.id, "REJECTED");
    } else if (dto.decision === "REQUEST_ADJUSTMENT") {
      // A instância fica IN_PROGRESS: quando o solicitante reenviar
      // (Assessments.submit() -> startWorkflow), reinicia da primeira etapa
      // elegível, preservando esta execução no histórico.
      await this.workflowRepository.updateAssessmentStatus(assessment.id, "PENDING_ADJUSTMENT");
    } else {
      await this.advanceToNextStep(execution);
    }

    const updated = await this.workflowRepository.findStepExecutionById(execution.id);
    if (!updated) throw new NotFoundException("Etapa de workflow não encontrada após a decisão.");
    return updated;
  }

  async getInstanceForUser(
    user: AuthenticatedUser,
    assessmentId: string,
  ): Promise<WorkflowInstanceDetail> {
    const assessment = await this.workflowRepository.findAssessmentContext(assessmentId);
    if (!assessment) throw new NotFoundException("Avaliação não encontrada.");
    if (assessment.tenantId !== user.tenantId) {
      throw new ForbiddenException("Avaliação de outro tenant.");
    }

    const canViewAll = user.permissions.includes(PERMISSIONS.ASSESSMENTS_VIEW_ALL);
    const canApprove = user.permissions.includes(PERMISSIONS.ASSESSMENTS_APPROVE);
    const isRequester = assessment.requesterId === user.id;
    if (!canViewAll && !canApprove && !isRequester) {
      throw new ForbiddenException("Sem permissão para visualizar o workflow desta avaliação.");
    }

    const instance = await this.workflowRepository.findInstanceByAssessmentId(assessmentId);
    if (!instance) {
      throw new NotFoundException("Esta avaliação ainda não iniciou um fluxo de aprovação.");
    }
    return instance;
  }

  /** "Caixa de entrada" do aprovador: etapas pendentes nos papéis que o usuário possui. */
  async getInbox(user: AuthenticatedUser) {
    const roleIds = await this.workflowRepository.findUserRoleIds(user.id);
    if (roleIds.length === 0) return [];
    return this.workflowRepository.findPendingStepsForRoles(user.tenantId, roleIds);
  }

  // --- Administração (workflows:manage) ------------------------------------------------
  listDefinitions(tenantId: string): Promise<WorkflowDefinitionWithSteps[]> {
    return this.workflowRepository.findAllDefinitions(tenantId);
  }

  getDefinition(tenantId: string, id: string): Promise<WorkflowDefinitionWithSteps> {
    return this.assertDefinitionInTenant(tenantId, id);
  }

  async createDefinition(
    tenantId: string,
    dto: CreateWorkflowDefinitionDto,
  ): Promise<WorkflowDefinitionWithSteps> {
    const definition = await this.workflowRepository.createDefinition({
      tenantId,
      name: dto.name,
      isDefault: false,
      isActive: true,
    });
    if (dto.isDefault) {
      return this.workflowRepository.setDefault(tenantId, definition.id);
    }
    return this.assertDefinitionInTenant(tenantId, definition.id);
  }

  async updateDefinition(
    tenantId: string,
    id: string,
    dto: UpdateWorkflowDefinitionDto,
  ): Promise<WorkflowDefinitionWithSteps> {
    await this.assertDefinitionInTenant(tenantId, id);
    return this.workflowRepository.updateDefinition(id, dto);
  }

  async setDefaultDefinition(tenantId: string, id: string): Promise<WorkflowDefinitionWithSteps> {
    await this.assertDefinitionInTenant(tenantId, id);
    return this.workflowRepository.setDefault(tenantId, id);
  }

  async addStep(tenantId: string, definitionId: string, dto: CreateStepDto) {
    const definition = await this.assertDefinitionInTenant(tenantId, definitionId);
    const order =
      dto.order ??
      (definition.steps.length > 0 ? Math.max(...definition.steps.map((s) => s.order)) + 1 : 1);

    return this.workflowRepository.createStep({
      workflowDefinitionId: definitionId,
      order,
      name: dto.name,
      responsibleRoleId: dto.responsibleRoleId,
      slaHours: dto.slaHours,
      isOptional: dto.isOptional ?? false,
      requiresLgpd: dto.requiresLgpd ?? false,
    });
  }

  async updateStep(tenantId: string, stepId: string, dto: UpdateStepDto) {
    const step = await this.assertStepInTenant(tenantId, stepId);
    return this.workflowRepository.updateStep(step.id, dto);
  }

  async removeStep(tenantId: string, stepId: string): Promise<void> {
    const step = await this.assertStepInTenant(tenantId, stepId);
    const usageCount = await this.workflowRepository.countExecutionsUsingStep(step.id);
    if (usageCount > 0) {
      throw new BadRequestException(
        "Esta etapa já foi usada em execuções de workflow e não pode ser removida.",
      );
    }
    await this.workflowRepository.deleteStep(step.id);
  }

  // --- Helpers ------------------------------------------------------------------
  private async advanceToNextStep(execution: StepExecutionDetail): Promise<void> {
    const assessment = execution.assessmentWorkflowInstance.assessment;
    const definition = await this.workflowRepository.findDefinitionById(
      execution.assessmentWorkflowInstance.workflowDefinitionId,
    );
    if (!definition) throw new NotFoundException("Definição de fluxo não encontrada.");

    const involvesLgpd = (await this.workflowRepository.countLgpdTriggers(assessment.id)) > 0;
    const next = this.nextEligibleStep(
      definition.steps,
      execution.workflowStep.order,
      involvesLgpd,
    );

    if (next) {
      await this.workflowRepository.updateInstance(execution.assessmentWorkflowInstanceId, {
        currentStepOrder: next.order,
      });
      await this.workflowRepository.createStepExecution({
        assessmentWorkflowInstanceId: execution.assessmentWorkflowInstanceId,
        workflowStepId: next.id,
        status: "IN_PROGRESS",
        slaDueAt: this.computeSlaDueAt(next.slaHours),
      });
    } else {
      // Não há mais etapas elegíveis: a última decisão fecha o fluxo.
      await this.workflowRepository.updateInstance(execution.assessmentWorkflowInstanceId, {
        status: "APPROVED",
      });
      await this.workflowRepository.updateAssessmentStatus(assessment.id, "APPROVED");
    }
  }

  private async userHasRole(userId: string, roleId: string): Promise<boolean> {
    const roleIds = await this.workflowRepository.findUserRoleIds(userId);
    return roleIds.includes(roleId);
  }

  private isStepEligible(step: Pick<WorkflowStep, "requiresLgpd">, involvesLgpd: boolean): boolean {
    return !step.requiresLgpd || involvesLgpd;
  }

  private firstEligibleStep(
    steps: WorkflowStep[],
    involvesLgpd: boolean,
  ): WorkflowStep | undefined {
    return [...steps]
      .sort((a, b) => a.order - b.order)
      .find((step) => this.isStepEligible(step, involvesLgpd));
  }

  private nextEligibleStep(
    steps: WorkflowStep[],
    afterOrder: number,
    involvesLgpd: boolean,
  ): WorkflowStep | undefined {
    return [...steps]
      .sort((a, b) => a.order - b.order)
      .find((step) => step.order > afterOrder && this.isStepEligible(step, involvesLgpd));
  }

  private computeSlaDueAt(slaHours: number): Date {
    return new Date(Date.now() + slaHours * 60 * 60 * 1000);
  }

  private async assertDefinitionInTenant(
    tenantId: string,
    id: string,
  ): Promise<WorkflowDefinitionWithSteps> {
    const definition = await this.workflowRepository.findDefinitionById(id);
    if (!definition) throw new NotFoundException("Fluxo de aprovação não encontrado.");
    if (definition.tenantId !== tenantId) throw new ForbiddenException("Fluxo de outro tenant.");
    return definition;
  }

  private async assertStepInTenant(tenantId: string, stepId: string) {
    const step = await this.workflowRepository.findStepById(stepId);
    if (!step) throw new NotFoundException("Etapa não encontrada.");
    if (step.workflowDefinition.tenantId !== tenantId) {
      throw new ForbiddenException("Etapa de outro tenant.");
    }
    return step;
  }
}
