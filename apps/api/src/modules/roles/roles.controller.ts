import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequireAnyPermission } from "../../common/decorators/require-any-permission.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { RolesService } from "./roles.service";

/**
 * Listagem mínima de papéis do tenant (id + name) — alimenta o seletor de
 * "papel responsável" no editor de etapas de workflow (`workflows:manage`,
 * Etapa G) e o diálogo de atribuição de papel a usuários (`users:manage`,
 * Etapa H). `RequireAnyPermission` em vez de `RequirePermissions`: quem tem
 * só uma das duas permissões ainda assim precisa conseguir listar papéis.
 */
@ApiTags("roles")
@RequireAnyPermission(PERMISSIONS.WORKFLOWS_MANAGE, PERMISSIONS.USERS_MANAGE)
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.findAll(user.tenantId);
  }
}
