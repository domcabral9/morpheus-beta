import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Criticality } from "@morpheus/database";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AuditLogService } from "../audit/audit-log.service";
import { InventoryRepository, InventoryItemDetail } from "./inventory.repository";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { ListInventoryQueryDto } from "./dto/list-inventory.query.dto";
import { ExportInventoryQueryDto } from "./dto/export-inventory.query.dto";

/** Cadência padrão de revisão para itens criados automaticamente na aprovação. */
const DEFAULT_REVIEW_CYCLE_MONTHS = 12;

export type InventoryItemWithOpinion = Omit<InventoryItemDetail, "assessment"> & {
  technicalOpinion: {
    id: string;
    number: string;
    classificationLabel: string;
    issuedAt: Date;
  } | null;
};

/** Achata `assessment.versions[0].technicalOpinion` (forma de query, com o
 * hop artificial de "versão mais recente") num campo único e opcional - a
 * API não deveria expor a rota de navegação do schema, só o resultado. */
function attachTechnicalOpinion(item: InventoryItemDetail): InventoryItemWithOpinion {
  const { assessment, ...rest } = item;
  return {
    ...rest,
    technicalOpinion: assessment?.versions[0]?.technicalOpinion ?? null,
  };
}

function toBoolean(value: string | undefined): boolean | undefined {
  return value === undefined ? undefined : value === "true";
}

export interface ApprovedAssessmentForInventory {
  id: string;
  softwareName: string;
  vendor: string;
  version: string | null;
  url: string | null;
  areaId: string;
  criticality: Criticality;
  responsibleId: string;
  hasRiskAnalysis: boolean;
  hasInfoSecClause: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(user: AuthenticatedUser, query: ListInventoryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { items, total } = await this.repository.findMany({
      tenantId: user.tenantId,
      status: query.status,
      areaId: query.areaId,
      type: query.type,
      criticality: query.criticality,
      origin: query.origin,
      hasRiskAnalysis: toBoolean(query.hasRiskAnalysis),
      hasInfoSecClause: toBoolean(query.hasInfoSecClause),
      page,
      pageSize,
    });
    return { items: items.map(attachTechnicalOpinion), total, page, pageSize };
  }

  /** Agregados pra aba "Visão geral" do módulo - sempre do tenant inteiro,
   * sem os filtros da listagem (ver nota no repository). */
  async getStats(user: AuthenticatedUser) {
    const REVIEW_DUE_SOON_DAYS = 30;
    return this.repository.getStats(user.tenantId, REVIEW_DUE_SOON_DAYS);
  }

  /** Todas as linhas que batem com o filtro, sem paginação - quem chama
   * decide o formato de saída (CSV/JSON), aqui só monta os dados. */
  async exportItems(
    user: AuthenticatedUser,
    query: ExportInventoryQueryDto,
  ): Promise<InventoryItemWithOpinion[]> {
    const items = await this.repository.findAllMatching({
      tenantId: user.tenantId,
      status: query.status,
      areaId: query.areaId,
      type: query.type,
      criticality: query.criticality,
      origin: query.origin,
      hasRiskAnalysis: toBoolean(query.hasRiskAnalysis),
      hasInfoSecClause: toBoolean(query.hasInfoSecClause),
    });
    const mapped = items.map(attachTechnicalOpinion);

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "DOWNLOAD",
      entityType: "SoftwareInventoryItem",
      metadata: { format: query.format ?? "csv", count: mapped.length },
    });

    return mapped;
  }

  async getById(user: AuthenticatedUser, id: string): Promise<InventoryItemWithOpinion> {
    const item = await this.getOwnedOrThrow(user.tenantId, id);
    return attachTechnicalOpinion(item);
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateInventoryItemDto,
  ): Promise<InventoryItemWithOpinion> {
    const item = await this.repository.create(
      {
        tenantId: user.tenantId,
        name: dto.name,
        vendor: dto.vendor,
        version: dto.version,
        url: dto.url,
        category: dto.category,
        type: dto.type,
        hostingProvider: dto.hostingProvider,
        areaId: dto.areaId,
        managerId: dto.managerId,
        technicalResponsibleId: dto.technicalResponsibleId,
        homologationDate: new Date(dto.homologationDate),
        nextReviewDate: new Date(dto.nextReviewDate),
        criticality: dto.criticality,
        dataClassification: dto.dataClassification,
        hasRiskAnalysis: dto.hasRiskAnalysis,
        hasInfoSecClause: dto.hasInfoSecClause,
      },
      dto.documentationLinks,
    );
    return attachTechnicalOpinion(item);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemWithOpinion> {
    const existing = await this.getOwnedOrThrow(user.tenantId, id);
    if (
      existing.assessmentId &&
      (dto.hasRiskAnalysis !== undefined || dto.hasInfoSecClause !== undefined)
    ) {
      throw new ForbiddenException(
        "ART/cláusula de segurança da informação são herdados da homologação e não podem ser editados diretamente no inventário.",
      );
    }
    const { documentationLinks, ...scalarFields } = dto;
    const item = await this.repository.update(id, {
      ...scalarFields,
      nextReviewDate: dto.nextReviewDate ? new Date(dto.nextReviewDate) : undefined,
    });
    if (documentationLinks === undefined) {
      return attachTechnicalOpinion(item);
    }
    await this.repository.setDocumentationLinks(id, user.tenantId, documentationLinks);
    const refreshed = await this.repository.findById(id);
    return attachTechnicalOpinion(refreshed ?? item);
  }

  /**
   * Criado automaticamente quando uma avaliação chega a Homologado (Etapa 6
   * -> WorkflowService). Categoria/tipo/classificação de dados nascem com
   * valores padrão conservadores (não tentamos inferir do questionário de
   * forma automática/frágil) - o gestor refina depois pelo CRUD
   * (`inventory:manage`). Defensivo contra duplicidade: se já existir um
   * item para esta avaliação (não deveria acontecer hoje, já que
   * APPROVED/REJECTED não são reenviáveis ainda), atualiza em vez de tentar
   * criar de novo.
   */
  async createFromApprovedAssessment(
    tenantId: string,
    assessment: ApprovedAssessmentForInventory,
  ): Promise<InventoryItemDetail> {
    const existing = await this.repository.findByAssessmentId(assessment.id);
    const now = new Date();
    const nextReviewDate = new Date(now);
    nextReviewDate.setMonth(nextReviewDate.getMonth() + DEFAULT_REVIEW_CYCLE_MONTHS);

    if (existing) {
      return this.repository.update(existing.id, {
        name: assessment.softwareName,
        vendor: assessment.vendor,
        version: assessment.version,
        url: assessment.url,
        areaId: assessment.areaId,
        criticality: assessment.criticality,
        hasRiskAnalysis: assessment.hasRiskAnalysis,
        hasInfoSecClause: assessment.hasInfoSecClause,
      });
    }

    return this.repository.create({
      tenantId,
      assessmentId: assessment.id,
      name: assessment.softwareName,
      vendor: assessment.vendor,
      version: assessment.version,
      url: assessment.url,
      category: "Não classificado",
      type: "SAAS",
      areaId: assessment.areaId,
      managerId: assessment.responsibleId,
      technicalResponsibleId: assessment.responsibleId,
      homologationDate: now,
      nextReviewDate,
      criticality: assessment.criticality,
      dataClassification: "INTERNAL",
      hasRiskAnalysis: assessment.hasRiskAnalysis,
      hasInfoSecClause: assessment.hasInfoSecClause,
    });
  }

  // --- Helpers ------------------------------------------------------------------
  private async getOwnedOrThrow(tenantId: string, id: string): Promise<InventoryItemDetail> {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException("Item de inventário não encontrado.");
    if (item.tenantId !== tenantId) throw new ForbiddenException("Item de outro tenant.");
    return item;
  }
}
