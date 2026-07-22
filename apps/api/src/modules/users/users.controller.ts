import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { RequireAnyPermission } from "../../common/decorators/require-any-permission.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { UsersService } from "./users.service";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { SetUserActiveDto } from "./dto/set-user-active.dto";

/**
 * Visualização de usuários do tenant, criação, ativação/desativação, e
 * atribuição/remoção de papel. Criação não define senha local (só SSO
 * just-in-time - `UsersService.findOrProvisionBySso` - ou seed fazem isso
 * hoje); um fluxo de "definir senha" fica para um incremento futuro.
 *
 * Sem `@RequirePermissions` de classe: `list()` é usado como seletor de
 * usuário em outras telas (inventário, filtro de auditoria), então tem gate
 * próprio mais aberto — as demais rotas continuam exigindo `users:manage` de
 * verdade.
 */
@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequireAnyPermission(PERMISSIONS.USERS_MANAGE, PERMISSIONS.INVENTORY_MANAGE, PERMISSIONS.AUDIT_VIEW)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listForTenant(user.tenantId);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get(":id")
  getById(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.usersService.getForTenant(user.tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Audit("CREATE", "User")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.tenantId, dto);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Audit("UPDATE", "User")
  @Patch(":id/active")
  setActive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SetUserActiveDto,
  ) {
    return this.usersService.setActive(user.tenantId, user.id, id, dto.isActive);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Audit("CREATE", "UserRole")
  @Post(":id/roles")
  assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(user.tenantId, id, dto.roleId);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
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
