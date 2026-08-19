import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AssessmentsService } from "./assessments.service";
import { CreateAssessmentDto } from "./dto/create-assessment.dto";
import { UpdateAssessmentDto } from "./dto/update-assessment.dto";
import { SubmitAnswersDto } from "./dto/submit-answers.dto";
import { ListAssessmentsQueryDto } from "./dto/list-assessments.query.dto";
import { ReassignRenewalRequesterDto } from "./dto/reassign-renewal-requester.dto";
import { DeleteAssessmentDto } from "./dto/delete-assessment.dto";

@ApiTags("assessments")
@Controller("assessments")
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_CREATE)
  @Audit("CREATE", "Assessment")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssessmentDto) {
    return this.assessmentsService.create(user, dto);
  }

  // Sem @RequirePermissions: a visibilidade (própria vs. todas) depende dos
  // dados, não é um simples "tem ou não tem a permissão X" - resolvida dentro
  // do service (ver assertCanView/findAllForUser).
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAssessmentsQueryDto) {
    return this.assessmentsService.findAllForUser(user, query);
  }

  // Precisa vir antes de `:id` - senão "blocked-areas" seria interpretado como um id.
  @Get("blocked-areas")
  listBlockedAreas(@CurrentUser() user: AuthenticatedUser) {
    return this.assessmentsService.listBlockedAreas(user);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.assessmentsService.findOneForUser(user, id);
  }

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_EDIT_OWN)
  @Audit("UPDATE", "Assessment")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.assessmentsService.update(user, id, dto);
  }

  // `assessments:reopen` já existe/já é seedada em todo papel "Administrador" - nunca era checada
  // em lugar nenhum até agora (ver plano de renovação anual, Fase 5). Sem `@Audit()`: o service já
  // grava o log manualmente com metadata rica (solicitante anterior/novo) - ver doc-comment do
  // decorator sobre não duplicar.
  @RequirePermissions(PERMISSIONS.ASSESSMENTS_REOPEN)
  @Patch(":id/renewal/reassign")
  reassignRenewalRequester(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReassignRenewalRequesterDto,
  ) {
    return this.assessmentsService.reassignRenewalRequester(user, id, dto);
  }

  @Get(":id/versions")
  getVersionHistory(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.assessmentsService.getVersionHistory(user, id);
  }

  @Get(":id/answers")
  getAnswers(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.assessmentsService.getAnswers(user, id);
  }

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_EDIT_OWN)
  @Put(":id/answers")
  upsertAnswers(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.assessmentsService.upsertAnswers(user, id, dto);
  }

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_SUBMIT)
  @Post(":id/submit")
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.assessmentsService.submit(user, id);
  }

  // Diz ao frontend, antes de abrir o dialog de confirmação, se deve
  // oferecer a opção "excluir o fornecedor também" - ver
  // AssessmentsService.resolveOrphanVendor.
  @RequirePermissions(PERMISSIONS.ASSESSMENTS_EDIT_OWN)
  @Get(":id/deletion-info")
  getDeletionInfo(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.assessmentsService.getDeletionInfo(user, id);
  }

  // Sem @Audit(): o service grava o log manualmente (precisa condicionar o
  // metadata a se o fornecedor foi apagado junto), mesmo motivo de
  // reassignRenewalRequester.
  @RequirePermissions(PERMISSIONS.ASSESSMENTS_EDIT_OWN)
  @Delete(":id")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: DeleteAssessmentDto,
  ) {
    await this.assessmentsService.deleteAssessment(user, id, dto);
  }
}
