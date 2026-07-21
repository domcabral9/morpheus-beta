import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { UsersService } from "./users.service";
import { AssignRoleDto } from "./dto/assign-role.dto";

/**
 * Escopo mínimo desta etapa (Etapa H do plano pós-roteiro): visualização de
 * usuários do tenant + atribuição/remoção de papel. Sem criar ou desativar
 * usuário — provisionamento hoje é só via SSO just-in-time
 * (`UsersService.findOrProvisionBySso`) ou seed; um fluxo de criação manual
 * fica para um incremento futuro, se for necessário.
 */
@ApiTags("users")
@RequirePermissions(PERMISSIONS.USERS_MANAGE)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listForTenant(user.tenantId);
  }

  @Get(":id")
  getById(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.usersService.getForTenant(user.tenantId, id);
  }

  @Audit("CREATE", "UserRole")
  @Post(":id/roles")
  assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(user.tenantId, id, dto.roleId);
  }

  @Audit("DELETE", "UserRole")
  @Delete(":id/roles/:roleId")
  removeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("roleId") roleId: string,
  ) {
    return this.usersService.removeRole(user.tenantId, id, roleId);
  }
}
