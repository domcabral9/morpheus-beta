import { Injectable } from "@nestjs/common";
import { NotificationType, Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateNotificationInput) {
    return this.prisma.notification.create({ data });
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
}
