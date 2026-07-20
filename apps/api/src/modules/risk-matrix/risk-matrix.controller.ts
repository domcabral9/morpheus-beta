import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { RiskMatrixService } from "./risk-matrix.service";
import { CreateRiskMatrixConfigDto } from "./dto/create-config.dto";
import { UpdateRiskMatrixConfigDto } from "./dto/update-config.dto";
import { CreateLevelDto } from "./dto/create-level.dto";
import { UpdateLevelDto } from "./dto/update-level.dto";
import { CreateClassificationDto } from "./dto/create-classification.dto";
import { UpdateClassificationDto } from "./dto/update-classification.dto";
import { UpsertCellDto } from "./dto/upsert-cell.dto";

@ApiTags("risk-matrix")
@RequirePermissions(PERMISSIONS.RISK_MATRIX_MANAGE)
@Controller("risk-matrix/admin")
export class RiskMatrixController {
  constructor(private readonly riskMatrixService: RiskMatrixService) {}

  // --- Config -----------------------------------------------------------------
  @Get("configs")
  listConfigs(@CurrentUser() user: AuthenticatedUser) {
    return this.riskMatrixService.listConfigs(user.tenantId);
  }

  @Get("configs/:id")
  getConfig(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.riskMatrixService.getConfig(user.tenantId, id);
  }

  @Audit("CREATE", "RiskMatrixConfig")
  @Post("configs")
  createConfig(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRiskMatrixConfigDto) {
    return this.riskMatrixService.createConfig(user.tenantId, dto);
  }

  @Audit("UPDATE", "RiskMatrixConfig")
  @Patch("configs/:id")
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateRiskMatrixConfigDto,
  ) {
    return this.riskMatrixService.updateConfig(user.tenantId, id, dto);
  }

  @Audit("UPDATE", "RiskMatrixConfig")
  @Post("configs/:id/activate")
  activateConfig(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.riskMatrixService.activateConfig(user.tenantId, id);
  }

  // --- Faixas de probabilidade --------------------------------------------------
  @Audit("CREATE", "ProbabilityLevel")
  @Post("configs/:id/probability-levels")
  addProbabilityLevel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") configId: string,
    @Body() dto: CreateLevelDto,
  ) {
    return this.riskMatrixService.addProbabilityLevel(user.tenantId, configId, dto);
  }

  @Audit("UPDATE", "ProbabilityLevel")
  @Patch("probability-levels/:levelId")
  updateProbabilityLevel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("levelId") levelId: string,
    @Body() dto: UpdateLevelDto,
  ) {
    return this.riskMatrixService.updateProbabilityLevel(user.tenantId, levelId, dto);
  }

  @Audit("DELETE", "ProbabilityLevel")
  @Delete("probability-levels/:levelId")
  removeProbabilityLevel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("levelId") levelId: string,
  ) {
    return this.riskMatrixService.removeProbabilityLevel(user.tenantId, levelId);
  }

  // --- Faixas de impacto ---------------------------------------------------------
  @Audit("CREATE", "ImpactLevel")
  @Post("configs/:id/impact-levels")
  addImpactLevel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") configId: string,
    @Body() dto: CreateLevelDto,
  ) {
    return this.riskMatrixService.addImpactLevel(user.tenantId, configId, dto);
  }

  @Audit("UPDATE", "ImpactLevel")
  @Patch("impact-levels/:levelId")
  updateImpactLevel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("levelId") levelId: string,
    @Body() dto: UpdateLevelDto,
  ) {
    return this.riskMatrixService.updateImpactLevel(user.tenantId, levelId, dto);
  }

  @Audit("DELETE", "ImpactLevel")
  @Delete("impact-levels/:levelId")
  removeImpactLevel(@CurrentUser() user: AuthenticatedUser, @Param("levelId") levelId: string) {
    return this.riskMatrixService.removeImpactLevel(user.tenantId, levelId);
  }

  // --- Classificações --------------------------------------------------------------
  @Audit("CREATE", "RiskClassification")
  @Post("configs/:id/classifications")
  addClassification(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") configId: string,
    @Body() dto: CreateClassificationDto,
  ) {
    return this.riskMatrixService.addClassification(user.tenantId, configId, dto);
  }

  @Audit("UPDATE", "RiskClassification")
  @Patch("classifications/:classificationId")
  updateClassification(
    @CurrentUser() user: AuthenticatedUser,
    @Param("classificationId") classificationId: string,
    @Body() dto: UpdateClassificationDto,
  ) {
    return this.riskMatrixService.updateClassification(user.tenantId, classificationId, dto);
  }

  @Audit("DELETE", "RiskClassification")
  @Delete("classifications/:classificationId")
  removeClassification(
    @CurrentUser() user: AuthenticatedUser,
    @Param("classificationId") classificationId: string,
  ) {
    return this.riskMatrixService.removeClassification(user.tenantId, classificationId);
  }

  // --- Células da matriz (heatmap, reservado para Etapa 9) ------------------------
  @Audit("CREATE", "RiskMatrixCell")
  @Post("configs/:id/cells")
  upsertCell(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") configId: string,
    @Body() dto: UpsertCellDto,
  ) {
    return this.riskMatrixService.upsertCell(user.tenantId, configId, dto);
  }

  @Audit("DELETE", "RiskMatrixCell")
  @Delete("cells/:cellId")
  removeCell(@CurrentUser() user: AuthenticatedUser, @Param("cellId") cellId: string) {
    return this.riskMatrixService.removeCell(user.tenantId, cellId);
  }
}
