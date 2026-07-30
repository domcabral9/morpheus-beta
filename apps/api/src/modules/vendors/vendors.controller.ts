import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { VendorsService } from "./vendors.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { ListVendorsQueryDto } from "./dto/list-vendors.query.dto";
import { CreateVendorAssessmentDto } from "./dto/create-vendor-assessment.dto";
import { CreateVendorQuestionCategoryDto } from "./dto/create-vendor-question-category.dto";
import { UpdateVendorQuestionCategoryDto } from "./dto/update-vendor-question-category.dto";
import { CreateVendorQuestionDto } from "./dto/create-vendor-question.dto";
import { UpdateVendorQuestionDto } from "./dto/update-vendor-question.dto";
import { VendorQuestionOptionDto } from "./dto/vendor-question-option.dto";
import { UpdateVendorQuestionOptionDto } from "./dto/update-vendor-question-option.dto";
import { CreateVendorTierConfigDto } from "./dto/create-vendor-tier-config.dto";
import { UpsertVendorTierThresholdDto } from "./dto/upsert-vendor-tier-threshold.dto";

@ApiTags("vendors")
@RequirePermissions(PERMISSIONS.VENDORS_VIEW)
@Controller("vendors")
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // --- Vendor -------------------------------------------------------------------

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListVendorsQueryDto) {
    return this.vendorsService.listVendors(user, query);
  }

  // Rota literal - precisa vir antes de `:id` abaixo, senão `:id` casa primeiro.
  @Get("tracking")
  getTracking(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getTracking(user);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vendorsService.getVendor(user, id);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("CREATE", "Vendor")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVendorDto) {
    return this.vendorsService.createVendor(user, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("UPDATE", "Vendor")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.updateVendor(user, id, dto);
  }

  @Get(":id/assessments")
  history(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vendorsService.getVendorHistory(user, id);
  }

  @Get(":id/assessments/:assessmentId")
  getAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") vendorId: string,
    @Param("assessmentId") assessmentId: string,
  ) {
    return this.vendorsService.getAssessment(user, vendorId, assessmentId);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Post(":id/assessments")
  createAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") vendorId: string,
    @Body() dto: CreateVendorAssessmentDto,
  ) {
    return this.vendorsService.createDraftAssessment(user, vendorId, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Patch(":id/assessments/:assessmentId")
  updateAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") vendorId: string,
    @Param("assessmentId") assessmentId: string,
    @Body() dto: CreateVendorAssessmentDto,
  ) {
    return this.vendorsService.updateDraftAssessment(user, vendorId, assessmentId, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Post(":id/assessments/:assessmentId/complete")
  completeAssessment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") vendorId: string,
    @Param("assessmentId") assessmentId: string,
  ) {
    return this.vendorsService.completeAssessment(user, vendorId, assessmentId);
  }

  // --- Questionário usado na tela de avaliação -----------------------------------

  @Get("questionnaire/active")
  getActiveQuestionnaire(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getActiveQuestionnaire(user);
  }

  // --- Administração: catálogo de perguntas ----------------------------------------

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Get("admin/categories")
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.listCategories(user);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("CREATE", "VendorQuestionCategory")
  @Post("admin/categories")
  createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVendorQuestionCategoryDto,
  ) {
    return this.vendorsService.createCategory(user, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("UPDATE", "VendorQuestionCategory")
  @Patch("admin/categories/:id")
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateVendorQuestionCategoryDto,
  ) {
    return this.vendorsService.updateCategory(user, id, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Get("admin/questions")
  listQuestions(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.listQuestions(user);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("CREATE", "VendorQuestion")
  @Post("admin/questions")
  createQuestion(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVendorQuestionDto) {
    return this.vendorsService.createQuestion(user, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("UPDATE", "VendorQuestion")
  @Patch("admin/questions/:id")
  updateQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateVendorQuestionDto,
  ) {
    return this.vendorsService.updateQuestion(user, id, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("CREATE", "VendorQuestionOption")
  @Post("admin/questions/:id/options")
  addOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") questionId: string,
    @Body() dto: VendorQuestionOptionDto,
  ) {
    return this.vendorsService.addOption(user, questionId, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("UPDATE", "VendorQuestionOption")
  @Patch("admin/options/:id")
  updateOption(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateVendorQuestionOptionDto,
  ) {
    return this.vendorsService.updateOption(user, id, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("DELETE", "VendorQuestionOption")
  @Delete("admin/options/:id")
  removeOption(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vendorsService.removeOption(user, id);
  }

  // --- Administração: tierização --------------------------------------------------

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Get("admin/tier-configs")
  listTierConfigs(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.listTierConfigs(user);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Get("admin/tier-configs/active")
  getActiveTierConfig(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getActiveTierConfig(user);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("CREATE", "VendorTierConfig")
  @Post("admin/tier-configs")
  createTierConfig(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVendorTierConfigDto) {
    return this.vendorsService.createTierConfig(user, dto);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("UPDATE", "VendorTierConfig")
  @Post("admin/tier-configs/:id/activate")
  activateTierConfig(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.vendorsService.activateTierConfig(user, id);
  }

  @RequirePermissions(PERMISSIONS.VENDORS_MANAGE)
  @Audit("UPDATE", "VendorTierThreshold")
  @Post("admin/tier-configs/:id/thresholds")
  upsertThreshold(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") configId: string,
    @Body() dto: UpsertVendorTierThresholdDto,
  ) {
    return this.vendorsService.upsertThreshold(user, configId, dto);
  }
}
