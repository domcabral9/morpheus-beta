import { Injectable } from "@nestjs/common";
import { Prisma, Tenant } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
}

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  // Só id/name/slug — o seletor de organização do super-admin não precisa (e
  // não deve expor) logoUrl/securityTeamName/opinionNumberPrefix de outras orgs.
  findAllSummary(): Promise<TenantSummary[]> {
    return this.prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  }

  update(id: string, data: Prisma.TenantUncheckedUpdateInput): Promise<Tenant> {
    return this.prisma.tenant.update({ where: { id }, data });
  }
}
