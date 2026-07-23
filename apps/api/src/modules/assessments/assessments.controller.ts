import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
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
  // dados, não é um simples "tem ou não tem a permissão X" — resolvida dentro
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
}
