import { Injectable } from "@nestjs/common";
import { Area } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AreasRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllActive(tenantId: string): Promise<Area[]> {
    return this.prisma.area.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string): Promise<Area | null> {
    return this.prisma.area.findUnique({ where: { id } });
  }
}
