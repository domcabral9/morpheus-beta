import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { WorkflowService } from "./workflow.service";
import { DecideStepDto } from "./dto/decide-step.dto";
import { BulkDecideStepsDto } from "./dto/bulk-decide-steps.dto";
import { CreateWorkflowDefinitionDto } from "./dto/create-definition.dto";
import { UpdateWorkflowDefinitionDto } from "./dto/update-definition.dto";
import { CreateStepDto } from "./dto/create-step.dto";
import { UpdateStepDto } from "./dto/update-step.dto";

@ApiTags("workflow")
@Controller("workflow")
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get("assessments/:assessmentId")
  getInstance(@CurrentUser() user: AuthenticatedUser, @Param("assessmentId") assessmentId: string) {
    return this.workflowService.getInstanceForUser(user, assessmentId);
  }

  /** Etapas pendentes nos papéis que o usuário logado possui. */
  @RequirePermissions(PERMISSIONS.ASSESSMENTS_APPROVE)
  @Get("inbox")
  getInbox(@CurrentUser() user: AuthenticatedUser) {
    return this.workflowService.getInbox(user);
  }

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_APPROVE)
  @Post("steps/:stepExecutionId/decide")
  decideStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param("stepExecutionId") stepExecutionId: string,
    @Body() dto: DecideStepDto,
  ) {
    return this.workflowService.decideStep(user, stepExecutionId, dto);
  }

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_APPROVE)
  @Post("steps/bulk-decide")
  bulkDecideSteps(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkDecideStepsDto) {
    return this.workflowService.bulkDecideSteps(user, dto);
  }

  // --- Administração --------------------------------------------------------------
  @RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
  @Get("admin/definitions")
  listDefinitions(@CurrentUser() user: AuthenticatedUser) {
    return this.workflowService.listDefinitions(user.tenantId);
  }

  @RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
  @Get("admin/definitions/:id")
  getDefinition(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.workflowService.getDefinition(user.tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
  @Audit("CREATE", "WorkflowDefinition")
  @Post("admin/definitions")
  createDefinition(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkflowDefinitionDto,
  ) {
    return this.workflowService.createDefinition(user.tenantId, dto);
  }

  @RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
  @Audit("UPDATE", "WorkflowDefinition")
  @Patch("admin/definitions/:id")
  updateDefinition(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
  ) {
    return this.workflowService.updateDefinition(user.tenantId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
  @Audit("UPDATE", "WorkflowDefinition")
  @Post("admin/definitions/:id/set-default")
  setDefaultDefinition(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.workflowService.setDefaultDefinition(user.tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
  @Audit("CREATE", "WorkflowStep")
  @Post("admin/definitions/:id/steps")
  addStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") definitionId: string,
    @Body() dto: CreateStepDto,
  ) {
    return this.workflowService.addStep(user.tenantId, definitionId, dto);
  }

  @RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
  @Audit("UPDATE", "WorkflowStep")
  @Patch("admin/steps/:stepId")
  updateStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param("stepId") stepId: string,
    @Body() dto: UpdateStepDto,
  ) {
    return this.workflowService.updateStep(user.tenantId, stepId, dto);
  }

  @RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
  @Audit("DELETE", "WorkflowStep")
  @Delete("admin/steps/:stepId")
  removeStep(@CurrentUser() user: AuthenticatedUser, @Param("stepId") stepId: string) {
    return this.workflowService.removeStep(user.tenantId, stepId);
  }
}
