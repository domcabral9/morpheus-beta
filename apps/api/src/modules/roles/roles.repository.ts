import { Injectable } from "@nestjs/common";
import { Prisma, Role } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

export interface RoleSummary {
  id: string;
  name: string;
}

export interface RoleWithTenant extends RoleSummary {
  tenantId: string;
}

export interface PermissionSummary {
  id: string;
  key: string;
  description: string;
}

// --- Administração (roles:manage) ---------------------------------------------
const roleAdminSelect = {
  id: true,
  name: true,
  description: true,
  isSystem: true,
  tenantId: true,
  _count: { select: { rolePermissions: true, userRoles: true } },
} satisfies Prisma.RoleSelect;

export type RoleAdminRaw = Prisma.RoleGetPayload<{ select: typeof roleAdminSelect }>;

const roleDetailInclude = {
  rolePermissions: { include: { permission: true } },
  _count: { select: { userRoles: true } },
} satisfies Prisma.RoleInclude;

export type RoleDetailRaw = Prisma.RoleGetPayload<{ include: typeof roleDetailInclude }>;

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllForTenant(tenantId: string): Promise<RoleSummary[]> {
    return this.prisma.role.findMany({
      where: { tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string): Promise<RoleWithTenant | null> {
    return this.prisma.role.findUnique({
      where: { id },
      select: { id: true, name: true, tenantId: true },
    });
  }

  findAllPermissions(): Promise<PermissionSummary[]> {
    return this.prisma.permission.findMany({
      select: { id: true, key: true, description: true },
      orderBy: { key: "asc" },
    });
  }

  findManyPermissionsByKeys(keys: string[]): Promise<PermissionSummary[]> {
    return this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true, description: true },
    });
  }

  findAllForTenantAdmin(tenantId: string): Promise<RoleAdminRaw[]> {
    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: roleAdminSelect,
    });
  }

  findDetailById(id: string): Promise<RoleDetailRaw | null> {
    return this.prisma.role.findUnique({ where: { id }, include: roleDetailInclude });
  }

  create(data: Prisma.RoleUncheckedCreateInput): Promise<Role> {
    return this.prisma.role.create({ data });
  }

  update(id: string, data: Prisma.RoleUncheckedUpdateInput): Promise<Role> {
    return this.prisma.role.update({ where: { id }, data });
  }

  async setPermissions(id: string, permissionIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      }),
    ]);
  }

  async countUsage(id: string): Promise<{ workflowSteps: number; userRoles: number }> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { _count: { select: { workflowSteps: true, userRoles: true } } },
    });
    return {
      workflowSteps: role?._count.workflowSteps ?? 0,
      userRoles: role?._count.userRoles ?? 0,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }
}
