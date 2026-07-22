import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  RolesRepository,
  RoleSummary,
  RoleWithTenant,
  RoleAdminRaw,
  RoleDetailRaw,
} from "./roles.repository";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

export interface RoleAdmin {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
}

export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { key: string; description: string }[];
  userCount: number;
}

function toRoleAdmin(role: RoleAdminRaw): RoleAdmin {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissionCount: role._count.rolePermissions,
    userCount: role._count.userRoles,
  };
}

function toRoleDetail(role: RoleDetailRaw): RoleDetail {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.rolePermissions.map((link) => ({
      key: link.permission.key,
      description: link.permission.description,
    })),
    userCount: role._count.userRoles,
  };
}

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  findAll(tenantId: string): Promise<RoleSummary[]> {
    return this.rolesRepository.findAllForTenant(tenantId);
  }

  findById(id: string): Promise<RoleWithTenant | null> {
    return this.rolesRepository.findById(id);
  }

  // --- Administração (roles:manage) --------------------------------------------
  listPermissionsCatalog() {
    return this.rolesRepository.findAllPermissions();
  }

  async listForAdmin(tenantId: string): Promise<RoleAdmin[]> {
    const roles = await this.rolesRepository.findAllForTenantAdmin(tenantId);
    return roles.map(toRoleAdmin);
  }

  async getDetail(tenantId: string, id: string): Promise<RoleDetail> {
    const role = await this.assertRoleDetailInTenant(tenantId, id);
    return toRoleDetail(role);
  }

  async create(tenantId: string, dto: CreateRoleDto): Promise<RoleDetail> {
    const duplicate = await this.rolesRepository.findAllForTenant(tenantId);
    if (duplicate.some((role) => role.name === dto.name)) {
      throw new BadRequestException("Já existe um papel com esse nome neste tenant.");
    }

    // "Replicar" é uma alternativa à lista manual, não um complemento - mesma
    // regra já usada em UsersService.create para replicateRolesFromUserId.
    let permissionKeys: string[];
    if (dto.replicateFromRoleId) {
      const source = await this.assertRoleDetailInTenant(tenantId, dto.replicateFromRoleId);
      permissionKeys = source.rolePermissions.map((link) => link.permission.key);
    } else {
      permissionKeys = [...new Set(dto.permissionKeys ?? [])];
    }

    const permissionIds = await this.resolvePermissionIds(permissionKeys);

    const created = await this.rolesRepository.create({
      tenantId,
      name: dto.name,
      description: dto.description,
    });
    await this.rolesRepository.setPermissions(created.id, permissionIds);

    return this.getDetail(tenantId, created.id);
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto): Promise<RoleDetail> {
    const role = await this.assertRoleDetailInTenant(tenantId, id);
    if (dto.name && dto.name !== role.name && role.isSystem) {
      throw new BadRequestException("Papéis do sistema não podem ser renomeados.");
    }
    await this.rolesRepository.update(id, { name: dto.name, description: dto.description });
    return this.getDetail(tenantId, id);
  }

  async setPermissions(tenantId: string, id: string, permissionKeys: string[]): Promise<RoleDetail> {
    await this.assertRoleDetailInTenant(tenantId, id);
    const permissionIds = await this.resolvePermissionIds([...new Set(permissionKeys)]);
    await this.rolesRepository.setPermissions(id, permissionIds);
    return this.getDetail(tenantId, id);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const role = await this.assertRoleDetailInTenant(tenantId, id);
    if (role.isSystem) {
      throw new BadRequestException("Papéis do sistema não podem ser excluídos.");
    }

    const usage = await this.rolesRepository.countUsage(id);
    if (usage.userRoles > 0) {
      throw new BadRequestException(
        `Este papel está atribuído a ${usage.userRoles} usuário(s) - remova a atribuição antes de excluir.`,
      );
    }
    if (usage.workflowSteps > 0) {
      throw new BadRequestException(
        "Este papel é responsável por uma ou mais etapas de workflow - ajuste o workflow antes de excluir.",
      );
    }

    await this.rolesRepository.delete(id);
  }

  // --- Helpers de tenant scoping ------------------------------------------------
  private async assertRoleDetailInTenant(tenantId: string, id: string): Promise<RoleDetailRaw> {
    const role = await this.rolesRepository.findDetailById(id);
    if (!role) throw new NotFoundException("Papel não encontrado.");
    if (role.tenantId !== tenantId) throw new ForbiddenException("Papel de outro tenant.");
    return role;
  }

  private async resolvePermissionIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const found = await this.rolesRepository.findManyPermissionsByKeys(keys);
    if (found.length !== keys.length) {
      throw new BadRequestException("Uma ou mais permissões informadas não existem.");
    }
    return found.map((permission) => permission.id);
  }
}
