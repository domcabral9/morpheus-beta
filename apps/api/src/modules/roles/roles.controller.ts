import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { RolesService } from "./roles.service";

/**
 * Listagem mínima de papéis do tenant (id + name) — hoje só alimenta o
 * seletor de "papel responsável" no editor de etapas de workflow
 * (`workflows:manage`). Reaproveita essa permissão em vez de introduzir uma
 * nova só para leitura; se outra tela precisar (ex.: atribuição de papéis a
 * usuários) e o usuário responsável por ela não tiver `workflows:manage`,
 * vale revisitar o gate então.
 */
@ApiTags("roles")
@RequirePermissions(PERMISSIONS.WORKFLOWS_MANAGE)
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.findAll(user.tenantId);
  }
}
