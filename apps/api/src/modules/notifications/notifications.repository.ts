import { Injectable } from "@nestjs/common";
import { NotificationType, Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  data: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        data: input.data as Prisma.InputJsonValue,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
      },
    });
  }

  findUserContact(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true },
    });
  }

  /** Todos os usuários ativos que hoje têm o papel informado (fila de aprovação por papel). */
  findUsersByRole(roleId: string) {
    return this.prisma.user.findMany({
      where: { isActive: true, userRoles: { some: { roleId } } },
      select: { id: true, name: true, email: true },
    });
  }

  /** Todos os usuários ativos do tenant que têm, por qualquer papel, a
   * permissão informada - diferente de `findUsersByRole`, que resolve um
   * único papel: aqui o conjunto de papéis que concede a permissão pode ser
   * >1 (ex.: `assessments:approve` hoje é concedido a 4 papéis diferentes),
   * e um único `findMany` já faz o dedupe se um usuário acumular mais de um
   * desses papéis - evita notificar a mesma pessoa duas vezes. */
  findUsersByPermission(tenantId: string, permissionKey: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        userRoles: {
          some: { role: { rolePermissions: { some: { permission: { key: permissionKey } } } } },
        },
      },
      select: { id: true, name: true, email: true },
    });
  }

  async findForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Prisma.NotificationGetPayload<object>[]; total: number }> {
    const where: Prisma.NotificationWhereInput = { userId };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
