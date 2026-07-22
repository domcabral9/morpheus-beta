import { Body, Controller, Get, Patch } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
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

  // Sobrepõe o @RequirePermissions(SYSTEM_CONFIGURE) de classe acima (guard
  // usa getAllAndOverride: metadado de método vence o de classe) — só
  // super-admin lista todas as organizações, mesmo que não tenha
  // system:configure em nenhuma delas.
  @RequirePermissions(PERMISSIONS.PLATFORM_CROSS_TENANT)
  @Get()
  listAll() {
    return this.tenantsService.listAll();
  }

  // Pré-autenticado e sem paginação de propósito: alimenta o dropdown de
  // organização da tela de login. @RequirePermissions() vazio sobrepõe o
  // SYSTEM_CONFIGURE de classe (mesmo mecanismo do listAll acima, só que
  // zerando a exigência em vez de trocar por outra). Em um SaaS de produção
  // real isso vaza o nome de todos os clientes para qualquer visitante não
  // autenticado — aceito aqui porque este é um projeto de portfólio/demo,
  // não uma base de clientes pagantes real. Retorna só name/slug (nunca
  // id) para manter a superfície exposta no mínimo necessário.
  @Public()
  @RequirePermissions()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("public")
  listAllPublic() {
    return this.tenantsService.listAllPublic();
  }

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
