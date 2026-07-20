import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { QuestionnaireService } from "./questionnaire.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { QuestionOptionDto } from "./dto/question-option.dto";
import { UpdateQuestionOptionDto } from "./dto/update-question-option.dto";
import { LinkControlDto } from "./dto/link-control.dto";

@ApiTags("questionnaire")
@Controller("questionnaire")
export class QuestionnaireController {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  /** Usado pela tela de resposta ao questionário — só perguntas/categorias ativas. */
  @Get("categories")
  getCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.questionnaireService.getCategories(user.tenantId);
  }

  // --- Administração ------------------------------------------------------------

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Get("admin/categories")
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.questionnaireService.listCategories(user.tenantId);
  }

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Audit("CREATE", "QuestionCategory")
  @Post("admin/categories")
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto) {
    return this.questionnaireService.createCategory(user.tenantId, dto);
  }

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Audit("UPDATE", "QuestionCategory")
  @Patch("admin/categories/:id")
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.questionnaireService.updateCategory(user.tenantId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Get("admin/questions")
  listQuestions(@CurrentUser() user: AuthenticatedUser) {
    return this.questionnaireService.listQuestions(user.tenantId);
  }

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Audit("CREATE", "Question")
  @Post("admin/questions")
  createQuestion(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQuestionDto) {
    return this.questionnaireService.createQuestion(user.tenantId, dto);
  }

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Audit("UPDATE", "Question")
  @Patch("admin/questions/:id")
  updateQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionnaireService.updateQuestion(user.tenantId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Audit("CREATE", "QuestionOption")
  @Post("admin/questions/:id/options")
  addOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") questionId: string,
    @Body() dto: QuestionOptionDto,
  ) {
    return this.questionnaireService.addOption(user.tenantId, questionId, dto);
  }

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Audit("UPDATE", "QuestionOption")
  @Patch("admin/options/:id")
  updateOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateQuestionOptionDto,
  ) {
    return this.questionnaireService.updateOption(user.tenantId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.QUESTIONS_MANAGE)
  @Audit("DELETE", "QuestionOption")
  @Delete("admin/options/:id")
  removeOption(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.questionnaireService.removeOption(user.tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.CONTROLS_MANAGE)
  @Audit("CREATE", "QuestionControl")
  @Post("admin/questions/:id/controls")
  linkControl(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") questionId: string,
    @Body() dto: LinkControlDto,
  ) {
    return this.questionnaireService.linkControl(user.tenantId, questionId, dto);
  }

  @RequirePermissions(PERMISSIONS.CONTROLS_MANAGE)
  @Audit("DELETE", "QuestionControl")
  @Delete("admin/questions/:id/controls/:controlId")
  unlinkControl(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") questionId: string,
    @Param("controlId") controlId: string,
  ) {
    return this.questionnaireService.unlinkControl(user.tenantId, questionId, controlId);
  }
}
