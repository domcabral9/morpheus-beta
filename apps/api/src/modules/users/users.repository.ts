import { Injectable } from "@nestjs/common";
import { Prisma, User } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Shape usada em toda a cadeia de autenticação/RBAC: o usuário mais a lista
 * já achatada (flat, sem duplicatas) das permission keys de todos os seus
 * papéis. Calculada aqui (na camada de dados) porque é uma projeção direta
 * de UserRole -> Role -> RolePermission -> Permission, não uma regra de
 * negócio.
 */
export type UserWithPermissions = User & { permissionKeys: string[] };

const userWithRolesInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRolesInclude }>;

function flattenPermissions(user: UserWithRoles): UserWithPermissions {
  const keys = new Set<string>();
  for (const userRole of user.userRoles) {
    for (const rolePermission of userRole.role.rolePermissions) {
      keys.add(rolePermission.permission.key);
    }
  }
  const { userRoles: _userRoles, ...rest } = user;
  return { ...rest, permissionKeys: [...keys] };
}

// --- Administração (users:manage) — visualização + atribuição de papéis ------------
// `select` explícito, não `include`: a tela administrativa não deve nunca ver
// `passwordHash`/`ssoSubject` de outro usuário — só os campos realmente
// exibidos na tela (nome, e-mail, status, último login, papéis).
const userAdminSelect = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  userRoles: { select: { role: { select: { id: true, name: true } } } },
} satisfies Prisma.UserSelect;

export type UserAdminRaw = Prisma.UserGetPayload<{ select: typeof userAdminSelect }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(tenantId: string, email: string): Promise<UserWithPermissions | null> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      include: userWithRolesInclude,
    });
    return user ? flattenPermissions(user) : null;
  }

  async findBySsoSubject(
    tenantId: string,
    ssoSubject: string,
  ): Promise<UserWithPermissions | null> {
    const user = await this.prisma.user.findFirst({
      where: { tenantId, ssoSubject },
      include: userWithRolesInclude,
    });
    return user ? flattenPermissions(user) : null;
  }

  async findById(id: string): Promise<UserWithPermissions | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithRolesInclude,
    });
    return user ? flattenPermissions(user) : null;
  }

  async create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  // --- Administração (users:manage) --------------------------------------------
  findAllForTenant(tenantId: string): Promise<UserAdminRaw[]> {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: userAdminSelect,
    });
  }

  findByIdRaw(id: string): Promise<UserAdminRaw | null> {
    return this.prisma.user.findUnique({ where: { id }, select: userAdminSelect });
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
  }
}
