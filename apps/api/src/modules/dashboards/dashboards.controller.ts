import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { DashboardsService } from "./dashboards.service";

@ApiTags("dashboards")
@Controller("dashboards")
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get("me")
  getUserDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardsService.getUserDashboard(user);
  }

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_VIEW_ALL)
  @Get("admin")
  getAdminDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardsService.getAdminDashboard(user.tenantId);
  }

  @RequirePermissions(PERMISSIONS.ASSESSMENTS_VIEW_ALL)
  @Get("executive")
  getExecutiveDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardsService.getExecutiveDashboard(user.tenantId);
  }

  /** Placar de maturidade por área — visível a qualquer usuário autenticado do tenant (gamificação). */
  @Get("leaderboard")
  getLeaderboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardsService.getAreaLeaderboard(user.tenantId);
  }
}
