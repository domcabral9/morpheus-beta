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
}
