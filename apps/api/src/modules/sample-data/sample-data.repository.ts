import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type SampleEntityType = "vendor" | "inventory-item" | "assessment";

export interface SampleDataItem {
  entityType: SampleEntityType;
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
}

/** Módulo leve, autocontido via PrismaService (global) - não importa
 * VendorsModule/InventoryModule/AssessmentsModule, mesmo raciocínio já usado
 * pelo RenewalModule pra evitar risco de circularidade no grafo de imports.
 * Os deletes abaixo reimplementam o mesmo `prisma.<model>.delete({where:
 * {id}})` fino que `VendorsRepository.remove`/`AssessmentsRepository.remove`
 * já fazem - não reaproveitados por import direto de propósito. */
@Injectable()
export class SampleDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllSamples(tenantId?: string): Promise<SampleDataItem[]> {
    const where = { isSampleData: true, ...(tenantId ? { tenantId } : {}) };

    const [vendors, inventoryItems, assessments] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        select: {
          id: true,
          name: true,
          tenantId: true,
          tenant: { select: { name: true } },
          createdById: true,
          createdBy: { select: { name: true } },
          createdAt: true,
        },
      }),
      this.prisma.softwareInventoryItem.findMany({
        where,
        select: {
          id: true,
          name: true,
          tenantId: true,
          tenant: { select: { name: true } },
          createdById: true,
          createdBy: { select: { name: true } },
          createdAt: true,
        },
      }),
      this.prisma.assessment.findMany({
        where,
        select: {
          id: true,
          softwareName: true,
          tenantId: true,
          tenant: { select: { name: true } },
          requesterId: true,
          requester: { select: { name: true } },
          createdAt: true,
        },
      }),
    ]);

    const items: SampleDataItem[] = [
      ...vendors.map((v) => ({
        entityType: "vendor" as const,
        id: v.id,
        name: v.name,
        tenantId: v.tenantId,
        tenantName: v.tenant.name,
        createdById: v.createdById,
        createdByName: v.createdBy?.name ?? null,
        createdAt: v.createdAt,
      })),
      ...inventoryItems.map((i) => ({
        entityType: "inventory-item" as const,
        id: i.id,
        name: i.name,
        tenantId: i.tenantId,
        tenantName: i.tenant.name,
        createdById: i.createdById,
        createdByName: i.createdBy?.name ?? null,
        createdAt: i.createdAt,
      })),
      // Assessment não tem createdById próprio - requesterId é o campo mais
      // próximo semanticamente ("quem é responsável pela existência deste
      // registro"), mapeado aqui pra manter o shape unificado da listagem.
      ...assessments.map((a) => ({
        entityType: "assessment" as const,
        id: a.id,
        name: a.softwareName,
        tenantId: a.tenantId,
        tenantName: a.tenant.name,
        createdById: a.requesterId,
        createdByName: a.requester.name,
        createdAt: a.createdAt,
      })),
    ];

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findSampleVendorById(id: string): Promise<{ id: string; tenantId: string } | null> {
    return this.prisma.vendor.findFirst({
      where: { id, isSampleData: true },
      select: { id: true, tenantId: true },
    });
  }

  findSampleInventoryItemById(id: string): Promise<{ id: string; tenantId: string } | null> {
    return this.prisma.softwareInventoryItem.findFirst({
      where: { id, isSampleData: true },
      select: { id: true, tenantId: true },
    });
  }

  findSampleAssessmentById(id: string): Promise<{ id: string; tenantId: string } | null> {
    return this.prisma.assessment.findFirst({
      where: { id, isSampleData: true },
      select: { id: true, tenantId: true },
    });
  }

  async removeVendor(id: string): Promise<void> {
    await this.prisma.vendor.delete({ where: { id } });
  }

  async removeInventoryItem(id: string): Promise<void> {
    await this.prisma.softwareInventoryItem.delete({ where: { id } });
  }

  async removeAssessment(id: string): Promise<void> {
    await this.prisma.assessment.delete({ where: { id } });
  }
}
