import { Body, Controller, Delete, Get, Param, Patch, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
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
import { SetUserPasswordDto } from "./dto/set-user-password.dto";

/**
 * Visualização de usuários do tenant, criação, ativação/desativação,
 * atribuição/remoção de papel e definição/reset de senha local. Criação e
 * definição de senha são ações desacopladas de propósito (`POST :id/password`
 * é chamada como segundo passo, tanto para dar a primeira senha de um
 * usuário novo quanto para resetar a de um já existente) - sem isso, um
 * usuário criado aqui só entra via SSO.
 *
 * Sem `@RequirePermissions` de classe: `list()` é usado como seletor de
 * usuário em outras telas (inventário, filtro de auditoria), então tem gate
 * próprio mais aberto - as demais rotas continuam exigindo `users:manage` de
 * verdade.
 */
@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequireAnyPermission(
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  )
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listForTenant(user.tenantId);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get(":id")
  getById(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.usersService.getForTenant(user.tenantId, id);
  }

  // Sem @RequirePermissions de propósito: qualquer usuário autenticado do
  // mesmo tenant pode ver o avatar de um colega - essas pessoas já aparecem
  // por nome em telas que não exigem users:manage (aprovações, avaliações,
  // fornecedores). Isolamento por tenant é reforçado no service/repository
  // (where com tenantId), não aqui.
  @ApiOperation({ summary: "Foto de perfil de outro usuário do mesmo tenant." })
  @Get(":id/avatar")
  async getAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const { buffer, contentType } = await this.usersService.getAvatarForUser(user.tenantId, id);
    res.set({
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Content-Length": String(buffer.length),
    });
    res.send(buffer);
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

  // Sem @Audit(): a auditoria é gravada explicitamente em
  // UsersService.setPassword porque precisa do metadata `initiatedBy`, que o
  // AuditInterceptor não carrega.
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Post(":id/password")
  setPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SetUserPasswordDto,
  ) {
    return this.usersService.setPassword(user.tenantId, user.id, id, dto.password);
  }

  // Sem @Audit(): mesmo motivo de setPassword acima - a auditoria é gravada
  // explicitamente em UsersService.forceDisableTwoFactor porque precisa do
  // metadata `initiatedBy`.
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Post(":id/force-disable-two-factor")
  forceDisableTwoFactor(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.usersService.forceDisableTwoFactor(user.tenantId, user.id, id);
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
