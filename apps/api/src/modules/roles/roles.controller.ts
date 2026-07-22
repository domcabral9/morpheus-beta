import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequireAnyPermission } from "../../common/decorators/require-any-permission.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Audit } from "../../common/decorators/audit.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { SetRolePermissionsDto } from "./dto/set-role-permissions.dto";

/**
 * `GET /roles` (sem permissão de classe além de RequireAnyPermission) é a
 * listagem mínima (id + name) que alimenta seletores em outras telas (papel
 * responsável de etapa de workflow, checklist de papéis em criar usuário) -
 * intocada por esta etapa. Todo o CRUD de verdade (criar/editar/excluir
 * papel, gerenciar permissões) é `roles:manage`, método a método.
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

  // "permissions" precisa ser declarado antes de ":id" - o Nest casa rotas na
  // ordem de declaração da classe, e ":id" genérico "engoliria" este path.
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Get("permissions")
  listPermissions() {
    return this.rolesService.listPermissionsCatalog();
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Get("admin")
  listForAdmin(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.listForAdmin(user.tenantId);
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Get(":id")
  getDetail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.rolesService.getDetail(user.tenantId, id);
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Audit("CREATE", "Role")
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user.tenantId, dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Audit("UPDATE", "Role")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(user.tenantId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Audit("UPDATE", "Role")
  @Patch(":id/permissions")
  setPermissions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setPermissions(user.tenantId, id, dto.permissionKeys);
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Audit("DELETE", "Role")
  @Delete(":id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.rolesService.remove(user.tenantId, id);
  }
}
