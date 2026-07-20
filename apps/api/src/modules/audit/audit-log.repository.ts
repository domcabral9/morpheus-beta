import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

export interface RecordAuditLogInput {
  tenantId?: string | null;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface AuditLogFilters {
  tenantId: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
}

const auditLogDetailInclude = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditLogInclude;

export type AuditLogDetail = Prisma.AuditLogGetPayload<{ include: typeof auditLogDetailInclude }>;

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: RecordAuditLogInput) {
    return this.prisma.auditLog.create({ data });
  }

  async findMany(
    filters: AuditLogFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: AuditLogDetail[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      tenantId: filters.tenantId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.from || filters.to ? { createdAt: { gte: filters.from, lte: filters.to } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: auditLogDetailInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
