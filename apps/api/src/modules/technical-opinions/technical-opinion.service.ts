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
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { STORAGE_ADAPTER, StorageAdapter } from "../storage/storage.interface";
import { isStorageBackedLogo } from "../tenants/tenants.service";
import {
  TechnicalOpinionRepository,
  AnswerForOpinion,
  StepExecutionForOpinion,
} from "./technical-opinion.repository";
import type { ListTechnicalOpinionsQueryDto } from "./dto/list-technical-opinions.query.dto";
import { PdfGeneratorService } from "./pdf-generator.service";
import type { OpinionPdfCategory, OpinionPdfData } from "./opinion-pdf-data.interface";

const MAX_NUMBER_RETRIES = 5;

/**
 * Orquestra a emissão do parecer técnico: reúne os dados já persistidos
 * (avaliação, versão, resultado de risco, histórico de workflow, respostas),
 * gera o número sequencial e o QR Code, manda montar o PDF e salva tudo.
 * Acionado pelo WorkflowService quando uma avaliação chega a um estado
 * terminal (APPROVED/REJECTED) — ver decideStep().
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
        "Avaliação sem nenhuma versão enviada — não é possível emitir parecer.",
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
      title: `Parecer técnico emitido: ${assessment.softwareName}`,
      body: `O parecer técnico nº ${number} da avaliação "${assessment.softwareName}" (${classificationLabel}) já está disponível para download.`,
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

  async getLatestForAssessment(
    user: AuthenticatedUser,
    assessmentId: string,
  ): Promise<TechnicalOpinion | null> {
    const assessment = await this.repository.findAssessmentContext(assessmentId);
    if (!assessment) throw new NotFoundException("Avaliação não encontrada.");
    this.assertCanView(user, assessment.tenantId, assessment.requester.id);
    return this.repository.findLatestForAssessment(assessmentId);
  }

  /** Tela de gestão: reusa a mesma regra de `assertCanView`, mas como cláusula
   * de listagem em vez de checar um parecer só — sem permissão nova. */
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

    return { items, total, page, pageSize };
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
   * Next.js (não passa pelo StorageAdapter — ver `isStorageBackedLogo`). Uma
   * falha de leitura (arquivo removido do storage, por exemplo) não deve
   * derrubar a emissão do parecer inteiro — só cai para o cabeçalho sem logo. */
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
