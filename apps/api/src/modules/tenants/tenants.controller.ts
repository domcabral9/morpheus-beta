import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { TenantsService } from "./tenants.service";
import { UpdateTenantDto } from "./dto/update-tenant.dto";

/**
 * Escopo mínimo desta etapa (Etapa I do plano pós-roteiro): ver e editar os
 * três campos de identidade visual/nomenclatura do parecer técnico
 * (`logoUrl`, `securityTeamName`, `opinionNumberPrefix`) — os únicos campos
 * do Tenant pensados para serem configuráveis pelo admin. `name`/`slug` não
 * entram aqui (mudar o slug quebraria login de todo mundo do tenant).
 */
@ApiTags("tenants")
@RequirePermissions(PERMISSIONS.SYSTEM_CONFIGURE)
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get("current")
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.getCurrent(user.tenantId);
  }

  @Audit("UPDATE", "Tenant")
  @Patch("current")
  updateCurrent(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateCurrent(user.tenantId, dto);
  }
}
