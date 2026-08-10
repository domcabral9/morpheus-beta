import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Criticality } from "@morpheus/database";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { PERMISSIONS } from "../../common/constants/permissions";
import { SeparationOfDutiesService } from "../../common/services/separation-of-duties.service";
import { withHasAvatar } from "../../common/utils/avatar.util";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { InventoryRepository, InventoryItemDetail } from "./inventory.repository";
import { InventoryApprovalRepository } from "./inventory-approval.repository";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { ListInventoryQueryDto } from "./dto/list-inventory.query.dto";
import { ExportInventoryQueryDto } from "./dto/export-inventory.query.dto";
import { CheckDuplicateInventoryQueryDto } from "./dto/check-duplicate-inventory.query.dto";
import {
  ApproveInventoryApprovalDto,
  RejectInventoryApprovalDto,
} from "./dto/decide-inventory-approval.dto";
import { EolCatalogRepository } from "./eol/eol-catalog.repository";
import { computeFreshness, FreshnessState } from "./eol/eol-freshness.util";
import { ReputationService } from "./reputation/reputation.service";
import { computeReputationState, ReputationState } from "./reputation/reputation-state.util";
import { ExposureService } from "./exposure/exposure.service";
import { computeExposureState, ExposureState } from "./exposure/exposure-state.util";
import type { InternetDbResult } from "./exposure/internetdb.client";

/** Cadência padrão de revisão para itens criados automaticamente na aprovação. */
const DEFAULT_REVIEW_CYCLE_MONTHS = 12;

export type InventoryItemWithOpinion = Omit<
  InventoryItemDetail,
  "assessment" | "eolProduct" | "exposureRawData"
> & {
  technicalOpinion: {
    id: string;
    number: string;
    classificationLabel: string;
    issuedAt: Date;
  } | null;
  eolProduct: { slug: string; name: string } | null;
  freshness: FreshnessState;
  reputationState: ReputationState;
  exposureState: ExposureState;
  exposureData: InternetDbResult | null;
};

/** Achata `assessment.versions[0].technicalOpinion` (forma de query, com o
 * hop artificial de "versão mais recente") num campo único e opcional - a
 * API não deveria expor a rota de navegação do schema, só o resultado.
 * Também achata `eolProduct` - nunca repassa `cycles` (bruto) pro cliente,
 * só o veredito já computado (`computeFreshness`, ver eol-freshness.util.ts). */
function mapItemDetail(item: InventoryItemDetail): InventoryItemWithOpinion {
  const { assessment, eolProduct, exposureRawData, ...rest } = item;
  const exposureData = exposureRawData as unknown as InternetDbResult | null;
  return {
    ...rest,
    technicalOpinion: assessment?.versions[0]?.technicalOpinion ?? null,
    eolProduct: eolProduct ? { slug: eolProduct.slug, name: eolProduct.name } : null,
    freshness: computeFreshness(item.version, eolProduct?.cycles),
    reputationState: computeReputationState({
      reputationLastCheckedAt: item.reputationLastCheckedAt,
      reputationVerdict: item.reputationVerdict,
      reputationDeclaredKnown: item.reputationDeclaredKnown,
    }),
    exposureState: computeExposureState({
      exposureLastCheckedAt: item.exposureLastCheckedAt,
      exposureRawData: exposureData,
    }),
    exposureData,
  };
}

function toBoolean(value: string | undefined): boolean | undefined {
  return value === undefined ? undefined : value === "true";
}

export interface ApprovedAssessmentForInventory {
  id: string;
  softwareName: string;
  vendor: string;
  vendorId: string | null;
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
    private readonly approvalRepository: InventoryApprovalRepository,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly separationOfDutiesService: SeparationOfDutiesService,
    private readonly eolCatalogRepository: EolCatalogRepository,
    private readonly reputationService: ReputationService,
    private readonly exposureService: ExposureService,
  ) {}

  async list(user: AuthenticatedUser, query: ListInventoryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { items, total } = await this.repository.findMany({
      tenantId: user.tenantId,
      search: query.search,
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
    return { items: items.map(mapItemDetail), total, page, pageSize };
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
      search: query.search,
      status: query.status,
      areaId: query.areaId,
      type: query.type,
      criticality: query.criticality,
      origin: query.origin,
      hasRiskAnalysis: toBoolean(query.hasRiskAnalysis),
      hasInfoSecClause: toBoolean(query.hasInfoSecClause),
    });
    const mapped = items.map(mapItemDetail);

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "DOWNLOAD",
      entityType: "SoftwareInventoryItem",
      metadata: { format: query.format ?? "csv", count: mapped.length },
    });

    return mapped;
  }

  /** Checagem em tempo real usada pelo formulário de "novo item" - não
   * bloqueia nada aqui, só informa se já existe um item com esse nome na
   * mesma área (a decisão de bloquear o submit é do frontend). */
  async checkDuplicate(user: AuthenticatedUser, query: CheckDuplicateInventoryQueryDto) {
    const match = await this.repository.findDuplicateByNameAndArea(
      user.tenantId,
      query.areaId,
      query.name,
    );
    if (!match) return { duplicate: null };
    const { assessmentId, ...rest } = match;
    return {
      duplicate: { ...rest, origin: assessmentId ? ("HOMOLOGATED" as const) : ("MANUAL" as const) },
    };
  }

  async getById(user: AuthenticatedUser, id: string): Promise<InventoryItemWithOpinion> {
    const item = await this.getOwnedOrThrow(user.tenantId, id);
    return mapItemDetail(item);
  }

  /** Autocomplete usado no formulário de item - busca só no cache local
   * (`EolProduct`), nunca chama o endoflife.date ao vivo por tecla digitada
   * (ver EolCatalogScheduler pra sincronização). Nunca devolve `cycles` -
   * o autocomplete só precisa de slug/name, e o array bruto pode ser grande. */
  async searchEolProducts(query: string): Promise<{ slug: string; name: string }[]> {
    const products = await this.eolCatalogRepository.search(query);
    return products.map(({ slug, name }) => ({ slug, name }));
  }

  /** Vínculo manual (nunca auto-detectado por nome) com o catálogo local de
   * frescor de versão - `eolProductId: null` desvincula. Rejeita um slug que
   * não existe no cache local em vez de gravar uma FK pra um produto
   * inexistente silenciosamente. */
  async linkEolProduct(
    user: AuthenticatedUser,
    id: string,
    eolProductId: string | null,
  ): Promise<InventoryItemWithOpinion> {
    await this.getOwnedOrThrow(user.tenantId, id);

    if (eolProductId !== null) {
      const product = await this.eolCatalogRepository.findBySlug(eolProductId);
      if (!product) {
        throw new BadRequestException("Produto não encontrado no catálogo de frescor de versão.");
      }
    }

    const item = await this.repository.update(id, {
      eolProductId,
      eolLinkedAt: eolProductId ? new Date() : null,
      eolLinkedByUserId: eolProductId ? user.id : null,
    });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entityType: "SoftwareInventoryItem",
      entityId: id,
      metadata: { field: "eolProduct", eolProductId },
    });

    return mapItemDetail(item);
  }

  /** Botão "verificar agora" - dispara uma checagem real contra o VirusTotal
   * (precedência hash-de-anexo > URL, ver ReputationService). `actingUserId`
   * vai pro audit log; a checagem automática noturna (varredura) chama
   * `ReputationService.performCheck` direto com `null`, sem passar por aqui
   * (não precisa de checagem de posse de tenant - já roda no escopo certo). */
  async checkReputation(user: AuthenticatedUser, id: string): Promise<InventoryItemWithOpinion> {
    const item = await this.getOwnedOrThrow(user.tenantId, id);
    const updated = await this.reputationService.performCheck(item, user.id);
    return mapItemDetail(updated);
  }

  /** Botão "verificar agora" da seção de exposição externa - dispara uma
   * checagem real contra a Shodan InternetDB, resolvendo IP público a partir
   * de `url` (ver ExposureService). Mesmo tratamento de `checkReputation`:
   * `actingUserId` vai pro audit log; a varredura noturna chama
   * `ExposureService.performCheck` direto com `null`. */
  async checkExposure(user: AuthenticatedUser, id: string): Promise<InventoryItemWithOpinion> {
    const item = await this.getOwnedOrThrow(user.tenantId, id);
    const updated = await this.exposureService.performCheck(item, user.id);
    return mapItemDetail(updated);
  }

  /** Flag manual declarada (mesma forma de `hasRiskAnalysis`) - fallback pra
   * software obviamente conhecido/confiável sem artefato pra checar de
   * verdade. Uma checagem automática já feita sempre prevalece na leitura
   * (ver computeReputationState) - esta flag só preenche a lacuna quando
   * nenhuma checagem existe. */
  async setReputationDeclaredKnown(
    user: AuthenticatedUser,
    id: string,
    declaredKnown: boolean,
  ): Promise<InventoryItemWithOpinion> {
    await this.getOwnedOrThrow(user.tenantId, id);
    const item = await this.repository.update(id, { reputationDeclaredKnown: declaredKnown });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entityType: "SoftwareInventoryItem",
      entityId: id,
      metadata: { field: "reputationDeclaredKnown", value: declaredKnown },
    });

    return mapItemDetail(item);
  }

  /** Cadastro manual (`POST /inventory`) sempre nasce `PENDING_APPROVAL` e
   * gera uma `InventoryApprovalRequest` — nunca vai direto pra `ACTIVE` (ver
   * fluxo de aprovação dedicado, `docs/changelog/2026-08.md`). `status` nunca
   * vem do DTO — `CreateInventoryItemDto` não tem esse campo. */
  async create(
    user: AuthenticatedUser,
    dto: CreateInventoryItemDto,
  ): Promise<InventoryItemWithOpinion> {
    const item = await this.repository.createWithApprovalRequest(
      {
        tenantId: user.tenantId,
        createdById: user.id,
        status: "PENDING_APPROVAL",
        name: dto.name,
        vendor: dto.vendor,
        vendorId: dto.vendorId,
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
      user.id,
      dto.documentationLinks,
    );

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "SUBMIT",
      entityType: "InventoryApprovalRequest",
      entityId: item.id,
      metadata: { event: "submitted", inventoryItemName: item.name },
    });
    await this.notifyApprovers(user.tenantId, item.name, item.id);

    return mapItemDetail(item);
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
    if (dto.status !== undefined) {
      if (existing.status === "PENDING_APPROVAL" || existing.status === "REJECTED") {
        throw new BadRequestException(
          "Use os endpoints de aprovação/reenvio para alterar o status deste item.",
        );
      }
      if (dto.status === "PENDING_APPROVAL" || dto.status === "REJECTED") {
        throw new BadRequestException("Este status só pode ser definido pelo fluxo de aprovação.");
      }
    }
    const { documentationLinks, ...scalarFields } = dto;
    const item = await this.repository.update(id, {
      ...scalarFields,
      nextReviewDate: dto.nextReviewDate ? new Date(dto.nextReviewDate) : undefined,
    });
    if (documentationLinks === undefined) {
      return mapItemDetail(item);
    }
    await this.repository.setDocumentationLinks(id, user.tenantId, documentationLinks);
    const refreshed = await this.repository.findById(id);
    return mapItemDetail(refreshed ?? item);
  }

  /** Fila de itens manuais aguardando decisão — só quem tem
   * `assessments:approve` enxerga (rota gated no controller). */
  async listPendingApprovals(user: AuthenticatedUser) {
    const items = await this.approvalRepository.findPendingItems(user.tenantId);
    return items.map((item) => ({
      ...item,
      approvalRequest: item.approvalRequest
        ? { ...item.approvalRequest, requester: withHasAvatar(item.approvalRequest.requester) }
        : item.approvalRequest,
    }));
  }

  async approve(
    user: AuthenticatedUser,
    id: string,
    dto: ApproveInventoryApprovalDto,
  ): Promise<InventoryItemWithOpinion> {
    const { approvalRequest } = await this.getPendingApprovalOrThrow(user.tenantId, id);
    this.separationOfDutiesService.assertNotSelfApproval(
      approvalRequest.requesterId,
      user.id,
      "aprovar",
    );

    await this.approvalRepository.markDecided(approvalRequest.id, {
      status: "APPROVED",
      decidedById: user.id,
      decisionNotes: dto.notes ?? null,
    });
    const item = await this.repository.update(id, { status: "ACTIVE" });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "APPROVE",
      entityType: "InventoryApprovalRequest",
      entityId: approvalRequest.id,
      metadata: { inventoryItemId: id, notes: dto.notes ?? null },
    });
    await this.notificationsService.notify({
      tenantId: user.tenantId,
      userId: approvalRequest.requesterId,
      type: "APPROVAL",
      title: `Item de inventário aprovado: ${item.name}`,
      body: `Seu cadastro manual de "${item.name}" foi aprovado e já está ativo no inventário.`,
      relatedEntityType: "SoftwareInventoryItem",
      relatedEntityId: id,
    });

    return mapItemDetail(item);
  }

  async reject(
    user: AuthenticatedUser,
    id: string,
    dto: RejectInventoryApprovalDto,
  ): Promise<InventoryItemWithOpinion> {
    const { approvalRequest } = await this.getPendingApprovalOrThrow(user.tenantId, id);
    this.separationOfDutiesService.assertNotSelfApproval(
      approvalRequest.requesterId,
      user.id,
      "reprovar",
    );

    await this.approvalRepository.markDecided(approvalRequest.id, {
      status: "REJECTED",
      decidedById: user.id,
      decisionNotes: dto.notes,
    });
    const item = await this.repository.update(id, { status: "REJECTED" });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "REJECT",
      entityType: "InventoryApprovalRequest",
      entityId: approvalRequest.id,
      metadata: { inventoryItemId: id, notes: dto.notes },
    });
    await this.notificationsService.notify({
      tenantId: user.tenantId,
      userId: approvalRequest.requesterId,
      type: "REJECTION",
      title: `Item de inventário reprovado: ${item.name}`,
      body: `Seu cadastro manual de "${item.name}" foi reprovado. Motivo: ${dto.notes}`,
      relatedEntityType: "SoftwareInventoryItem",
      relatedEntityId: id,
    });

    return mapItemDetail(item);
  }

  /** Só o criador original pode reenviar um item reprovado — espelho, do
   * lado do reenvio, da checagem de auto-aprovação acima. */
  async resubmit(user: AuthenticatedUser, id: string): Promise<InventoryItemWithOpinion> {
    const existing = await this.getOwnedOrThrow(user.tenantId, id);
    if (existing.status !== "REJECTED") {
      throw new BadRequestException("Só itens reprovados podem ser reenviados.");
    }
    const approvalRequest = await this.approvalRepository.findByItemId(id);
    if (!approvalRequest) {
      throw new NotFoundException("Solicitação de aprovação não encontrada para este item.");
    }
    if (approvalRequest.requesterId !== user.id) {
      throw new ForbiddenException("Só quem criou o item pode reenviá-lo para aprovação.");
    }

    await this.approvalRepository.resetForResubmit(approvalRequest.id);
    const item = await this.repository.update(id, { status: "PENDING_APPROVAL" });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "SUBMIT",
      entityType: "InventoryApprovalRequest",
      entityId: approvalRequest.id,
      metadata: { event: "resubmitted", inventoryItemName: item.name },
    });
    await this.notifyApprovers(user.tenantId, item.name, id);

    return mapItemDetail(item);
  }

  /**
   * Criado automaticamente quando uma avaliação chega a Homologado (Etapa 6
   * -> WorkflowService). Categoria/tipo/classificação de dados nascem com
   * valores padrão conservadores (não tentamos inferir do questionário de
   * forma automática/frágil) - o gestor refina depois pelo CRUD
   * (`inventory:manage`). Se já existir um item pra esta avaliação, atualiza
   * em vez de criar de novo - hoje isso só acontece na aprovação de um ciclo
   * de renovação anual (`PENDING_RENEWAL` reabrindo a mesma Assessment), já
   * que uma Assessment recém-criada nunca teria um item associado ainda.
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
      // Renovação aprovada: reseta o ciclo exatamente como uma homologação
      // nova - próxima revisão em +12 meses, status volta pra ACTIVE mesmo
      // que o item estivesse EXPIRED (bloqueando a área) ou PENDING_REVIEW.
      return this.repository.update(existing.id, {
        name: assessment.softwareName,
        vendor: assessment.vendor,
        vendorId: assessment.vendorId,
        version: assessment.version,
        url: assessment.url,
        areaId: assessment.areaId,
        criticality: assessment.criticality,
        hasRiskAnalysis: assessment.hasRiskAnalysis,
        hasInfoSecClause: assessment.hasInfoSecClause,
        nextReviewDate,
        status: "ACTIVE",
      });
    }

    return this.repository.create({
      tenantId,
      assessmentId: assessment.id,
      name: assessment.softwareName,
      vendor: assessment.vendor,
      vendorId: assessment.vendorId,
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

  /** Item precisa estar `PENDING_APPROVAL` e ter uma `InventoryApprovalRequest`
   * viva pra approve/reject decidirem — cobre também a race de "já decidido
   * por outro aprovador nesse meio-tempo" (400, não um 200 silencioso). */
  private async getPendingApprovalOrThrow(tenantId: string, id: string) {
    const item = await this.getOwnedOrThrow(tenantId, id);
    if (item.status !== "PENDING_APPROVAL") {
      throw new BadRequestException("Este item não está aguardando aprovação.");
    }
    const approvalRequest = await this.approvalRepository.findByItemId(id);
    if (!approvalRequest) {
      throw new NotFoundException("Solicitação de aprovação não encontrada para este item.");
    }
    return { item, approvalRequest };
  }

  private async notifyApprovers(tenantId: string, itemName: string, itemId: string): Promise<void> {
    await this.notificationsService.notifyPermissionHolders(
      tenantId,
      PERMISSIONS.ASSESSMENTS_APPROVE,
      {
        type: "INVENTORY_APPROVAL_REQUESTED",
        title: `Novo item de inventário aguardando aprovação: ${itemName}`,
        body: `"${itemName}" foi enviado para aprovação de cadastro manual no inventário.`,
        relatedEntityType: "SoftwareInventoryItem",
        relatedEntityId: itemId,
      },
    );
  }
}
