import { Injectable } from "@nestjs/common";
import { Prisma, Tenant } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.TenantUncheckedUpdateInput): Promise<Tenant> {
    return this.prisma.tenant.update({ where: { id }, data });
  }
}
