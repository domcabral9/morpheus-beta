import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as QRCode from "qrcode";
import { TechnicalOpinion } from "@morpheus/database";
import { PERMISSIONS } from "../../common/constants/permissions";
import { withHasAvatar } from "../../common/utils/avatar.util";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { STORAGE_ADAPTER, StorageAdapter } from "../storage/storage.interface";
import { isStorageBackedLogo } from "../tenants/tenants.service";
import { InventoryService } from "../inventory/inventory.service";
import { computeFreshness } from "../inventory/eol/eol-freshness.util";
import { computeReputationState } from "../inventory/reputation/reputation-state.util";
import { computeExposureState } from "../inventory/exposure/exposure-state.util";
import type { InternetDbResult } from "../inventory/exposure/internetdb.client";
import {
  TechnicalOpinionRepository,
  AnswerForOpinion,
  StepExecutionForOpinion,
} from "./technical-opinion.repository";
import type { ListTechnicalOpinionsQueryDto } from "./dto/list-technical-opinions.query.dto";
import { PdfGeneratorService } from "./pdf-generator.service";
import type {
  OpinionPdfCategory,
  OpinionPdfData,
  OpinionPdfInventoryItem,
  OpinionPdfRecommendations,
} from "./opinion-pdf-data.interface";
import {
  computeTopRiskFactors,
  MethodologyRiskDimension,
  MethodologyScorableAnswer,
} from "./opinion-methodology.util";

const MAX_NUMBER_RETRIES = 5;

/** Parágrafo fixo, sem menção a pesos/faixas específicos (configuráveis por
 * tenant via RiskMatrixConfig) - explica o mecanismo em termos gerais. */
const METHODOLOGY_SUMMARY =
  "O score de risco é calculado a partir das respostas do questionário: cada pergunta tem um " +
  "peso de importância definido pelo administrador e contribui para uma ou ambas as dimensões " +
  "de risco (Probabilidade e Impacto). O motor calcula uma média ponderada do risco por " +
  "dimensão, inverte o resultado para um score de segurança (0 a 5, onde valores mais altos são " +
  "mais favoráveis) e classifica o resultado contra as faixas de risco configuradas pela " +
  "organização. Os fatores abaixo são as respostas que mais pesaram no resultado desta avaliação.";

/**
 * Orquestra a emissão do parecer técnico: reúne os dados já persistidos
 * (avaliação, versão, resultado de risco, histórico de workflow, respostas),
 * gera o número sequencial e o QR Code, manda montar o PDF e salva tudo.
 * Acionado pelo WorkflowService quando uma avaliação chega a um estado
 * terminal (APPROVED/REJECTED) - ver decideStep().
 */
@Injectable()
export class TechnicalOpinionService {
  private readonly logger = new Logger(TechnicalOpinionService.name);

  constructor(
    private readonly repository: TechnicalOpinionRepository,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly inventoryService: InventoryService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async generateForAssessment(
    tenantId: string,
    assessmentId: string,
    finalStatus: "APPROVED" | "REJECTED",
    issuedById: string,
  ): Promise<TechnicalOpinion> {
    const assessment = await this.repository.findAssessmentContext(assessmentId);
    if (!assessment) throw new NotFoundException("Avaliação não encontrada.");

    const version = await this.repository.findLatestVersion(assessmentId);
    if (!version) {
      throw new UnprocessableEntityException(
        "Avaliação sem nenhuma versão enviada: não é possível emitir parecer.",
      );
    }

    const [riskResult, workflowHistory, answers] = await Promise.all([
      this.repository.findRiskResult(version.id),
      this.repository.findWorkflowHistory(assessmentId),
      this.repository.findAnswers(assessmentId),
    ]);

    const issuedAt = new Date();
    const number = await this.reserveNextNumber(
      tenantId,
      assessment.tenant.opinionNumberPrefix,
      issuedAt,
    );
    const verificationUrl = this.buildVerificationUrl(assessment.tenant.slug, number);
    const qrCodePng = await QRCode.toBuffer(verificationUrl, {
      type: "png",
      width: 240,
      margin: 1,
    });

    const classificationLabel =
      riskResult?.riskClassification.label ??
      (finalStatus === "APPROVED" ? "Homologado" : "Rejeitado");
    const classificationColor =
      riskResult?.riskClassification.color ?? (finalStatus === "APPROVED" ? "#16a34a" : "#dc2626");
    const logoBuffer = await this.resolveLogoBuffer(assessment.tenant.logoUrl);

    const inventoryItem =
      finalStatus === "APPROVED" ? await this.buildInventoryItemSnapshot(assessmentId) : null;
    const methodologyAnswers = this.buildMethodologyAnswers(answers);

    const pdfData: OpinionPdfData = {
      documentNumber: number,
      issuedAt,
      finalStatus,
      classificationLabel,
      classificationColor,
      tenantName: assessment.tenant.name,
      securityTeamName: assessment.tenant.securityTeamName ?? "Equipe de Segurança da Informação",
      logoBuffer,
      softwareName: assessment.softwareName,
      vendor: assessment.vendor,
      version: assessment.version,
      url: assessment.url,
      areaName: assessment.area.name,
      responsibleName: assessment.responsible.name,
      responsibleEmail: assessment.responsible.email,
      criticality: assessment.criticality,
      justification: assessment.justification,
      linkedTicket: assessment.linkedTicket,
      installerFileHash: assessment.installerFileHash,
      versionLabel: version.versionLabel,
      executiveContext: this.buildExecutiveContext(
        assessment.softwareName,
        assessment.vendor,
        assessment.justification,
      ),
      vendorCompliance: {
        hasRiskAnalysis: assessment.hasRiskAnalysis,
        hasInfoSecClause: assessment.hasInfoSecClause,
        hasSoc2Report: assessment.hasSoc2Report,
        hasIso27001Certificate: assessment.hasIso27001Certificate,
        linkedVendor: assessment.linkedVendor
          ? {
              name: assessment.linkedVendor.name,
              tier: assessment.linkedVendor.currentTier,
              tierLabel: assessment.linkedVendor.currentTierLabel,
            }
          : null,
      },
      attachments: assessment.attachments.map((attachment) => ({
        fileName: attachment.fileName,
        category: attachment.category,
        uploadedAt: attachment.uploadedAt,
      })),
      inventoryItem,
      methodology: {
        summary: METHODOLOGY_SUMMARY,
        topFactors: computeTopRiskFactors(methodologyAnswers),
      },
      recommendations: this.buildRecommendations(workflowHistory),
      riskScores: riskResult
        ? {
            probabilityScore: Number(riskResult.probabilityScore),
            impactScore: Number(riskResult.impactScore),
            totalScore: Number(riskResult.totalScore),
            probabilityLevelLabel: riskResult.probabilityLevel.label,
            impactLevelLabel: riskResult.impactLevel.label,
          }
        : null,
      categories: this.groupAnswersByCategory(answers),
      approvalHistory: workflowHistory.map((execution) => this.toApprovalStep(execution)),
      verificationUrl,
      qrCodePng,
    };

    const pdfBuffer = await this.pdfGenerator.build(pdfData);
    const storageKey = `technical-opinions/${tenantId}/${version.id}.pdf`;
    await this.storage.save(storageKey, pdfBuffer);

    const opinion = await this.repository.create({
      tenantId,
      assessmentVersionId: version.id,
      number,
      hash: assessment.installerFileHash ?? "",
      qrCodeData: verificationUrl,
      classificationLabel,
      issuedById,
      storageKey,
    });

    await this.notificationsService.notify({
      tenantId,
      userId: assessment.requester.id,
      type: "OPINION_ISSUED",
      data: { softwareName: assessment.softwareName, number, classificationLabel },
      relatedEntityType: "TechnicalOpinion",
      relatedEntityId: opinion.id,
    });

    return opinion;
  }

  async getPdfForDownload(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ opinion: TechnicalOpinion; buffer: Buffer }> {
    const context = await this.repository.findAuthorizationContext(id);
    if (!context) throw new NotFoundException("Parecer técnico não encontrado.");
    const assessment = await this.repository.findAssessmentContext(context.assessmentId);
    if (!assessment) throw new NotFoundException("Avaliação não encontrada.");
    this.assertCanView(user, assessment.tenantId, assessment.requester.id);

    const opinion = await this.repository.findById(id);
    if (!opinion) throw new NotFoundException("Parecer técnico não encontrado.");
    const buffer = await this.storage.read(opinion.storageKey);

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "DOWNLOAD",
      entityType: "TechnicalOpinion",
      entityId: opinion.id,
      metadata: { number: opinion.number },
    });

    return { opinion, buffer };
  }

  /** Tela de gestão: reusa a mesma regra de `assertCanView`, mas como cláusula
   * de listagem em vez de checar um parecer só - sem permissão nova. */
  async findAllForTenant(user: AuthenticatedUser, query: ListTechnicalOpinionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const canViewAll =
      user.permissions.includes(PERMISSIONS.ASSESSMENTS_VIEW_ALL) ||
      user.permissions.includes(PERMISSIONS.ASSESSMENTS_APPROVE);

    const { items, total } = await this.repository.findAllForTenant(
      {
        tenantId: user.tenantId,
        requesterId: canViewAll ? undefined : user.id,
        assessmentId: query.assessmentId,
        issuedById: query.issuedById,
        classificationLabel: query.classificationLabel,
        number: query.number,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      page,
      pageSize,
    );

    return {
      items: items.map((item) => ({ ...item, issuedBy: withHasAvatar(item.issuedBy) })),
      total,
      page,
      pageSize,
    };
  }

  async verify(tenantSlug: string, number: string) {
    const opinion = await this.repository.findByTenantSlugAndNumber(tenantSlug, number);
    if (!opinion) {
      return { valid: false as const };
    }
    return {
      valid: true as const,
      number: opinion.number,
      classificationLabel: opinion.classificationLabel,
      issuedAt: opinion.issuedAt,
    };
  }

  // --- Helpers ------------------------------------------------------------------
  private assertCanView(user: AuthenticatedUser, tenantId: string, requesterId: string): void {
    if (tenantId !== user.tenantId) {
      throw new ForbiddenException("Parecer de outro tenant.");
    }
    const canViewAll = user.permissions.includes(PERMISSIONS.ASSESSMENTS_VIEW_ALL);
    const canApprove = user.permissions.includes(PERMISSIONS.ASSESSMENTS_APPROVE);
    const isRequester = requesterId === user.id;
    if (!canViewAll && !canApprove && !isRequester) {
      throw new ForbiddenException("Sem permissão para visualizar este parecer técnico.");
    }
  }

  /** `null` quando não há logo, ou quando o logo é um caminho estático do
   * Next.js (não passa pelo StorageAdapter - ver `isStorageBackedLogo`). Uma
   * falha de leitura (arquivo removido do storage, por exemplo) não deve
   * derrubar a emissão do parecer inteiro - só cai para o cabeçalho sem logo. */
  private async resolveLogoBuffer(logoUrl: string | null): Promise<Buffer | null> {
    if (!logoUrl || !isStorageBackedLogo(logoUrl)) return null;
    try {
      return await this.storage.read(logoUrl);
    } catch (error) {
      this.logger.warn(`Falha ao ler o logo do tenant para o parecer técnico: ${String(error)}`);
      return null;
    }
  }

  private async reserveNextNumber(
    tenantId: string,
    prefix: string,
    issuedAt: Date,
  ): Promise<string> {
    const period = this.formatPeriod(issuedAt);

    for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt++) {
      const count = await this.repository.countForTenantAndPeriod(tenantId, prefix, period);
      const candidate = `${prefix}-${period}-${String(count + 1).padStart(3, "0")}`;
      const existing = await this.repository.findByTenantAndNumber(tenantId, candidate);
      if (!existing) return candidate;
    }

    throw new UnprocessableEntityException(
      "Não foi possível reservar um número de parecer único após múltiplas tentativas.",
    );
  }

  private formatPeriod(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${month}${date.getFullYear()}`;
  }

  private buildVerificationUrl(tenantSlug: string, number: string): string {
    const base = this.configService.get<string>("PUBLIC_API_URL", "http://localhost:3001");
    return `${base}/technical-opinions/verify/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(number)}`;
  }

  /** Template determinístico (sem geração probabilística) - resumo executivo
   * a partir de dado real já persistido. Ver decisão de não depender de LLM
   * externa neste parecer. */
  private buildExecutiveContext(
    softwareName: string,
    vendor: string,
    justification: string,
  ): string {
    return (
      `Este parecer técnico avalia o software "${softwareName}", fornecido por ${vendor}, ` +
      `submetido para homologação de segurança da informação. Segundo o solicitante, a ` +
      `justificativa de uso registrada foi: "${justification}"`
    );
  }

  /** Só presente quando o item de inventário já existe (avaliação aprovada -
   * ver o reorder em WorkflowService.decideStep) E de fato foi encontrado -
   * `null` em qualquer outro caso, nunca lança (a ausência do item não pode
   * impedir a emissão do parecer). */
  private async buildInventoryItemSnapshot(
    assessmentId: string,
  ): Promise<OpinionPdfInventoryItem | null> {
    const snapshot = await this.inventoryService.getInventoryEnrichmentSnapshot(assessmentId);
    if (!snapshot) return null;

    const webBase = this.configService.get<string>("PUBLIC_WEB_URL", "http://localhost:3000");
    return {
      url: `${webBase}/pt-BR/inventory/${snapshot.id}`,
      freshnessState: computeFreshness(snapshot.version, snapshot.eolProduct?.cycles ?? null),
      reputationState: computeReputationState({
        reputationLastCheckedAt: snapshot.reputationLastCheckedAt,
        reputationVerdict: snapshot.reputationVerdict,
        reputationDeclaredKnown: snapshot.reputationDeclaredKnown,
      }),
      exposureState: computeExposureState({
        exposureLastCheckedAt: snapshot.exposureLastCheckedAt,
        exposureRawData: snapshot.exposureRawData as unknown as InternetDbResult | null,
      }),
    };
  }

  /** Mesmo cálculo de `AssessmentsService.resolveScorableAnswers` (peso ×
   * score de risco por resposta) - duplicado deliberadamente aqui (fronteira
   * de módulo diferente), ver `computeTopRiskFactors`. */
  private buildMethodologyAnswers(answers: AnswerForOpinion[]): MethodologyScorableAnswer[] {
    const scorable: MethodologyScorableAnswer[] = [];

    for (const answer of answers) {
      if (answer.question.type === "TEXT") continue;

      let score: number | null = null;
      if (answer.question.type === "SCALE") {
        score = answer.scaleValue ?? null;
      } else if (answer.selectedOptions.length > 0) {
        const sum = answer.selectedOptions.reduce(
          (acc, selected) => acc + Number(selected.questionOption.score),
          0,
        );
        score = sum / answer.selectedOptions.length;
      }
      if (score === null) continue;

      scorable.push({
        questionText: answer.question.text,
        weight: Number(answer.question.weight),
        riskDimension: answer.question.riskDimension as MethodologyRiskDimension,
        score,
      });
    }

    return scorable;
  }

  /** Agregação estruturada dos comentários reais já registrados nas etapas
   * REJECTED/ADJUSTMENT_REQUESTED - nunca inventa um motivo que o aprovador
   * não escreveu. `null` quando não há nenhum comentário real (mesmo numa
   * avaliação REJECTED sem motivo registrado) - sem dado, sem seção. */
  private buildRecommendations(
    workflowHistory: StepExecutionForOpinion[],
  ): OpinionPdfRecommendations | null {
    const reasons = workflowHistory
      .filter((step) => step.status === "REJECTED" || step.status === "ADJUSTMENT_REQUESTED")
      .map((step) => step.comments?.trim())
      .filter((comment): comment is string => Boolean(comment));

    if (reasons.length === 0) return null;

    return {
      reasons,
      closingNote:
        "Para uma eventual resubmissão, revise os pontos acima e reenvie a avaliação para nova análise.",
    };
  }

  private groupAnswersByCategory(answers: AnswerForOpinion[]): OpinionPdfCategory[] {
    const byCategory = new Map<string, OpinionPdfCategory>();

    for (const answer of answers) {
      const answerText = this.formatAnswerText(answer);
      if (!answerText) continue;

      const categoryName = answer.question.category.name;
      if (!byCategory.has(categoryName)) {
        byCategory.set(categoryName, { categoryName, answers: [] });
      }
      byCategory.get(categoryName)!.answers.push({
        questionText: answer.question.text,
        answerText,
      });
    }

    return [...byCategory.values()];
  }

  private formatAnswerText(answer: AnswerForOpinion): string | null {
    if (answer.selectedOptions.length > 0) {
      return answer.selectedOptions.map((option) => option.questionOption.label).join(", ");
    }
    if (answer.scaleValue !== null && answer.scaleValue !== undefined) {
      return String(answer.scaleValue);
    }
    if (answer.textValue?.trim()) {
      return answer.textValue.trim();
    }
    return null;
  }

  private toApprovalStep(execution: StepExecutionForOpinion) {
    return {
      stepName: execution.workflowStep.name,
      responsibleRoleName: execution.workflowStep.responsibleRole.name,
      status: execution.status,
      decidedByName: execution.decidedBy?.name ?? null,
      decidedAt: execution.decidedAt,
      comments: execution.comments,
    };
  }
}
