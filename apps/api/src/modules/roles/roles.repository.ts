import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface RoleSummary {
  id: string;
  name: string;
}

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
}
