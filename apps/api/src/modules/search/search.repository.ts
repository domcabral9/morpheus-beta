import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface AssessmentSearchRow {
  id: string;
  softwareName: string;
  status: string;
  area: { name: string };
  updatedAt: Date;
}

export interface InventorySearchRow {
  id: string;
  name: string;
  status: string;
  area: { name: string };
}

export interface TechnicalOpinionSearchRow {
  id: string;
  number: string;
  classificationLabel: string;
  assessmentVersion: { assessment: { softwareName: string } };
}

@Injectable()
export class SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  searchAssessments(
    tenantId: string,
    requesterId: string | undefined,
    q: string,
    limit: number,
  ): Promise<AssessmentSearchRow[]> {
    return this.prisma.assessment.findMany({
      where: {
        tenantId,
        ...(requesterId ? { requesterId } : {}),
        softwareName: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        softwareName: true,
        status: true,
        area: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
  }

  searchInventoryItems(tenantId: string, q: string, limit: number): Promise<InventorySearchRow[]> {
    return this.prisma.softwareInventoryItem.findMany({
      where: { tenantId, name: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        status: true,
        area: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: limit,
    });
  }

  searchTechnicalOpinions(
    tenantId: string,
    requesterId: string | undefined,
    q: string,
    limit: number,
  ): Promise<TechnicalOpinionSearchRow[]> {
    return this.prisma.technicalOpinion.findMany({
      where: {
        tenantId,
        assessmentVersion: {
          assessment: {
            ...(requesterId ? { requesterId } : {}),
            softwareName: { contains: q, mode: "insensitive" },
          },
        },
      },
      select: {
        id: true,
        number: true,
        classificationLabel: true,
        assessmentVersion: { select: { assessment: { select: { softwareName: true } } } },
      },
      orderBy: { issuedAt: "desc" },
      take: limit,
    });
  }
}
