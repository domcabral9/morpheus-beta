import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssessmentStatus, AttachmentCategory } from "@morpheus/database";
import { PERMISSIONS } from "../../common/constants/permissions";
import { withHasAvatar } from "../../common/utils/avatar.util";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AreasService } from "../areas/areas.service";
import { UsersService } from "../users/users.service";
import { QuestionnaireService } from "../questionnaire/questionnaire.service";
import { RiskEvaluationService } from "../risk-engine/risk-evaluation.service";
import type { RiskDimensionInput, ScorableAnswer } from "../risk-engine/risk-engine.service";
import { WorkflowService } from "../workflow/workflow.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { VendorsService } from "../vendors/vendors.service";
import { AttachmentsRepository, AttachmentDetail } from "../attachments/attachments.repository";
import {
  AssessmentsRepository,
  AssessmentDetail,
  AnswerWithOptions,
} from "./assessments.repository";
import { CreateAssessmentDto } from "./dto/create-assessment.dto";
import { UpdateAssessmentDto } from "./dto/update-assessment.dto";
import { SubmitAnswersDto } from "./dto/submit-answers.dto";
import { ListAssessmentsQueryDto } from "./dto/list-assessments.query.dto";
import { ReassignRenewalRequesterDto } from "./dto/reassign-renewal-requester.dto";
import { DeleteAssessmentDto } from "./dto/delete-assessment.dto";
import type { QuestionWithOptions } from "../questionnaire/questionnaire.repository";

const EDITABLE_STATUSES: AssessmentStatus[] = ["DRAFT", "PENDING_ADJUSTMENT", "PENDING_RENEWAL"];

function hasPermission(user: AuthenticatedUser, key: string): boolean {
  return user.permissions.includes(key);
}

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly assessmentsRepository: AssessmentsRepository,
    private readonly areasService: AreasService,
    private readonly usersService: UsersService,
    private readonly questionnaireService: QuestionnaireService,
    private readonly riskEvaluationService: RiskEvaluationService,
    private readonly workflowService: WorkflowService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly vendorsService: VendorsService,
    private readonly attachmentsRepository: AttachmentsRepository,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateAssessmentDto): Promise<AssessmentDetail> {
    if (dto.isSampleData && !user.isSuperAdmin) {
      throw new ForbiddenException("Só super-admin pode marcar um registro como dado de amostra.");
    }
    await this.assertAreaInTenant(user.tenantId, dto.areaId);
    await this.assertUserInTenant(user.tenantId, dto.responsibleId);
    await this.assertAreaNotBlocked(user.tenantId, dto.areaId);
    // `dto.vendor` é obrigatório em CreateAssessmentDto - o resultado nunca
    // é undefined neste caminho (só quando não há vendorId nem fallback).
    const vendorName = (await this.resolveVendorName(user.tenantId, dto.vendorId, dto.vendor))!;

    return this.assessmentsRepository.create({
      tenantId: user.tenantId,
      softwareName: dto.softwareName,
      vendor: vendorName,
      vendorId: dto.vendorId,
      version: dto.version,
      url: dto.url,
      responsibleId: dto.responsibleId,
      areaId: dto.areaId,
      criticality: dto.criticality,
      justification: dto.justification,
      linkedTicket: dto.linkedTicket,
      installerFileHash: dto.installerFileHash,
      hasRiskAnalysis: dto.hasRiskAnalysis,
      hasInfoSecClause: dto.hasInfoSecClause,
      hasSoc2Report: dto.hasSoc2Report,
      hasIso27001Certificate: dto.hasIso27001Certificate,
      isSampleData: dto.isSampleData ?? false,
      requesterId: user.id,
      status: "DRAFT",
    });
  }

  listBlockedAreas(user: AuthenticatedUser): Promise<string[]> {
    return this.assessmentsRepository.findBlockedAreaIds(user.tenantId);
  }

  async findAllForUser(user: AuthenticatedUser, query: ListAssessmentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const canViewAll = hasPermission(user, PERMISSIONS.ASSESSMENTS_VIEW_ALL);
    if (!canViewAll && !hasPermission(user, PERMISSIONS.ASSESSMENTS_VIEW_OWN)) {
      throw new ForbiddenException("Sem permissão para visualizar avaliações.");
    }

    const { items, total } = await this.assessmentsRepository.findMany({
      tenantId: user.tenantId,
      requesterId: canViewAll ? undefined : user.id,
      status: query.status,
      page,
      pageSize,
    });

    return { items, total, page, pageSize };
  }

  async findOneForUser(user: AuthenticatedUser, id: string) {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    this.assertCanView(user, assessment);
    return { ...assessment, requester: withHasAvatar(assessment.requester) };
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateAssessmentDto,
  ): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    this.assertCanEdit(user, assessment);

    if (dto.areaId) {
      // Trocar a área durante um ciclo de renovação permitiria burlar um
      // futuro bloqueio de área (Fase 4) só reatribuindo a avaliação a uma
      // área sem pendência.
      if (assessment.status === "PENDING_RENEWAL") {
        throw new ForbiddenException(
          "Não é possível trocar a área durante um ciclo de renovação em andamento.",
        );
      }
      await this.assertAreaInTenant(user.tenantId, dto.areaId);
    }
    if (dto.responsibleId) {
      await this.assertUserInTenant(user.tenantId, dto.responsibleId);
    }
    if (dto.vendorId) {
      dto.vendor = await this.resolveVendorName(user.tenantId, dto.vendorId, dto.vendor);
    }

    return this.assessmentsRepository.update(id, dto);
  }

  /**
   * Quando o analista escolhe um Vendor real no picker (decisão #3 do plano
   * de avaliação de fornecedores), grava/atualiza também o texto livre
   * `vendor` com `Vendor.name` - snapshot denormalizado que evita mudar todo
   * lugar que hoje interpola `assessment.vendor` como string simples (PDF do
   * parecer, notificações, templates do RenewalScheduler).
   */
  private async resolveVendorName(
    tenantId: string,
    vendorId: string | undefined,
    fallbackVendor: string | undefined,
  ): Promise<string | undefined> {
    if (!vendorId) return fallbackVendor;
    const vendor = await this.vendorsService.findByIdForTenant(tenantId, vendorId);
    if (!vendor) throw new NotFoundException("Fornecedor (Vendor) não encontrado.");
    return vendor.name;
  }

  async getAnswers(user: AuthenticatedUser, id: string) {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    this.assertCanView(user, assessment);
    return this.assessmentsRepository.findAnswers(id);
  }

  async upsertAnswers(
    user: AuthenticatedUser,
    id: string,
    dto: SubmitAnswersDto,
  ): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    this.assertCanEdit(user, assessment);

    await this.assessmentsRepository.upsertAnswers(id, dto.answers);
    return this.getOwnedOrThrow(user.tenantId, id);
  }

  async submit(user: AuthenticatedUser, id: string): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);

    if (assessment.requesterId !== user.id) {
      throw new ForbiddenException("Só quem criou a avaliação pode enviá-la para análise.");
    }
    if (!hasPermission(user, PERMISSIONS.ASSESSMENTS_SUBMIT)) {
      throw new ForbiddenException("Sem permissão para enviar avaliações.");
    }
    if (!EDITABLE_STATUSES.includes(assessment.status)) {
      throw new BadRequestException(
        `Avaliação em status "${assessment.status}" não pode ser enviada.`,
      );
    }

    const questions = await this.questionnaireService
      .getCategories(user.tenantId)
      .then((categories) => categories.flatMap((category) => category.questions));
    const answers = await this.assessmentsRepository.findAnswers(id);

    this.assertQuestionnaireComplete(questions, answers);

    const [involvesLgpd, attachments] = await Promise.all([
      this.workflowService.involvesLgpd(id),
      this.attachmentsRepository.findMany({ tenantId: user.tenantId, assessmentId: id }),
    ]);
    this.assertComplianceEvidence(assessment, attachments, involvesLgpd);

    const versionLabel = await this.nextVersionLabel(id);

    const version = await this.assessmentsRepository.createVersion({
      assessmentId: id,
      versionLabel,
      changeReason:
        assessment.status === "PENDING_RENEWAL"
          ? "Renovação anual"
          : assessment.status === "PENDING_ADJUSTMENT"
            ? "Reenvio após ajuste"
            : "Envio inicial",
      createdById: user.id,
      snapshotJson: {
        assessment: {
          softwareName: assessment.softwareName,
          vendor: assessment.vendor,
          version: assessment.version,
          url: assessment.url,
          criticality: assessment.criticality,
          justification: assessment.justification,
          areaId: assessment.areaId,
          responsibleId: assessment.responsibleId,
        },
        answers: answers.map((answer) => ({
          questionId: answer.questionId,
          textValue: answer.textValue,
          scaleValue: answer.scaleValue,
          selectedOptionIds: answer.selectedOptions.map((o) => o.questionOptionId),
        })),
      },
    });

    // Motor de risco: calcula e persiste o RiskResult desta versão a partir
    // das mesmas respostas já carregadas para o snapshot acima.
    const scorableAnswers = this.resolveScorableAnswers(questions, answers);
    await this.riskEvaluationService.evaluate(user.tenantId, version.id, scorableAnswers);

    // Workflow de aprovação: inicia (ou reinicia, se for reenvio após ajuste)
    // a instância de aprovação na primeira etapa elegível.
    await this.workflowService.startWorkflow(user.tenantId, id);

    const updated = await this.assessmentsRepository.update(id, { status: "IN_REVIEW" });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "SUBMIT",
      entityType: "Assessment",
      entityId: id,
      metadata: { versionLabel },
    });

    return updated;
  }

  async getVersionHistory(user: AuthenticatedUser, id: string) {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    this.assertCanView(user, assessment);
    const versions = await this.assessmentsRepository.findVersionsWithDetails(id);
    return versions.map((version) => ({
      ...version,
      createdBy: withHasAvatar(version.createdBy),
    }));
  }

  /**
   * Reatribuição de solicitante durante um ciclo de renovação (Fase 5 do
   * plano de renovação anual) - só pra cobrir o caso do solicitante original
   * ter saído da empresa. Restrita a `PENDING_RENEWAL`: não é uma feature
   * geral de "trocar solicitante" pra qualquer avaliação em qualquer status.
   */
  async reassignRenewalRequester(
    user: AuthenticatedUser,
    id: string,
    dto: ReassignRenewalRequesterDto,
  ): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);

    if (assessment.status !== "PENDING_RENEWAL") {
      throw new BadRequestException(
        `Só é possível reatribuir o solicitante durante um ciclo de renovação em andamento (status atual: "${assessment.status}").`,
      );
    }

    const newRequester = await this.usersService.findById(dto.newRequesterId);
    if (!newRequester || newRequester.tenantId !== user.tenantId) {
      throw new BadRequestException("Novo solicitante inválido para este tenant.");
    }
    if (!newRequester.isActive) {
      throw new BadRequestException("Novo solicitante precisa estar ativo.");
    }

    const previousRequesterId = assessment.requesterId;
    const updated = await this.assessmentsRepository.update(id, {
      requesterId: dto.newRequesterId,
    });

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entityType: "Assessment",
      entityId: id,
      metadata: {
        reason: "renewal_requester_reassigned",
        previousRequesterId,
        newRequesterId: dto.newRequesterId,
        justification: dto.reason,
      },
    });

    await this.notificationsService.notify({
      tenantId: user.tenantId,
      userId: dto.newRequesterId,
      type: "RENEWAL_REQUESTER_REASSIGNED",
      data: { softwareName: updated.softwareName, vendor: updated.vendor },
      relatedEntityType: "Assessment",
      relatedEntityId: id,
    });

    return updated;
  }

  /**
   * "Desfazer" uma avaliação em rascunho antes de enviá-la (achado
   * 2026-08-19: testando o formulário, o usuário criou uma avaliação e um
   * fornecedor de teste com o mesmo nome, e não havia como excluir nenhum
   * dos dois). Devolve se o fornecedor vinculado (se houver) está órfão o
   * suficiente pra também ser oferecido pra exclusão - ver
   * `resolveOrphanVendor`.
   */
  async getDeletionInfo(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ orphanVendor: { id: string; name: string } | null }> {
    const assessment = await this.assertDraftOwnedByRequester(user, id);
    const orphanVendor = await this.resolveOrphanVendor(user, assessment);
    return { orphanVendor };
  }

  async deleteAssessment(
    user: AuthenticatedUser,
    id: string,
    dto: DeleteAssessmentDto,
  ): Promise<void> {
    const assessment = await this.assertDraftOwnedByRequester(user, id);

    // Reavalia do zero - nunca confia que o client chamou getDeletionInfo
    // antes, nem que nada mudou desde então.
    const orphanVendor = dto.deleteVendor ? await this.resolveOrphanVendor(user, assessment) : null;

    await this.assessmentsRepository.remove(assessment.id);
    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "DELETE",
      entityType: "Assessment",
      entityId: assessment.id,
      metadata: { softwareName: assessment.softwareName, vendorDeletedTogether: !!orphanVendor },
    });

    if (orphanVendor) {
      await this.vendorsService.removeVendor(user, orphanVendor.id);
      await this.auditLogService.record({
        tenantId: user.tenantId,
        userId: user.id,
        action: "DELETE",
        entityType: "Vendor",
        entityId: orphanVendor.id,
        metadata: { name: orphanVendor.name, reason: "orphan_after_draft_assessment_deletion" },
      });
    }
  }

  // --- Helpers ------------------------------------------------------------------

  private async getOwnedOrThrow(tenantId: string, id: string): Promise<AssessmentDetail> {
    const assessment = await this.assessmentsRepository.findById(id);
    if (!assessment) throw new NotFoundException("Avaliação não encontrada.");
    if (assessment.tenantId !== tenantId) {
      throw new ForbiddenException("Avaliação de outro tenant.");
    }
    return assessment;
  }

  /** Checagem própria pra exclusão - não reaproveita `assertCanEdit`
   * porque o conjunto de status permitido é deliberadamente mais estreito
   * (só `DRAFT`, não `EDITABLE_STATUSES` inteiro): `PENDING_ADJUSTMENT`/
   * `PENDING_RENEWAL` já têm histórico de workflow associado - não é
   * "desfazer uma criação", é uma avaliação real em andamento. */
  private async assertDraftOwnedByRequester(
    user: AuthenticatedUser,
    id: string,
  ): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    if (assessment.requesterId !== user.id) {
      throw new ForbiddenException("Só quem criou a avaliação pode excluí-la.");
    }
    if (!hasPermission(user, PERMISSIONS.ASSESSMENTS_EDIT_OWN)) {
      throw new ForbiddenException("Sem permissão para excluir avaliações.");
    }
    if (assessment.status !== "DRAFT") {
      throw new BadRequestException(
        `Avaliação em status "${assessment.status}" não pode ser excluída.`,
      );
    }
    return assessment;
  }

  /** Um fornecedor só é oferecido/excluído junto com a avaliação quando
   * TODAS as condições valem: quem excluir foi quem criou o fornecedor, e
   * ele nunca foi usado em lugar nenhum (nenhuma outra Assessment, nenhuma
   * VendorAssessment/ART - rascunho ou concluída). Derivado sempre na hora,
   * sem nenhum campo de rastreamento novo. */
  private async resolveOrphanVendor(
    user: AuthenticatedUser,
    assessment: AssessmentDetail,
  ): Promise<{ id: string; name: string } | null> {
    const vendor = assessment.linkedVendor;
    if (!vendor || vendor.createdById !== user.id) return null;

    const [otherAssessments, vendorAssessments] = await Promise.all([
      this.assessmentsRepository.countOtherAssessmentsForVendor(vendor.id, assessment.id),
      this.vendorsService.countVendorAssessments(vendor.id),
    ]);
    if (otherAssessments > 0 || vendorAssessments > 0) return null;

    return { id: vendor.id, name: vendor.name };
  }

  private assertCanView(user: AuthenticatedUser, assessment: AssessmentDetail): void {
    const isOwner = assessment.requesterId === user.id;
    const canViewAll = hasPermission(user, PERMISSIONS.ASSESSMENTS_VIEW_ALL);
    const canViewOwn = isOwner && hasPermission(user, PERMISSIONS.ASSESSMENTS_VIEW_OWN);
    if (!canViewAll && !canViewOwn) {
      throw new ForbiddenException("Você não pode visualizar avaliações de terceiros.");
    }
  }

  private assertCanEdit(user: AuthenticatedUser, assessment: AssessmentDetail): void {
    if (assessment.requesterId !== user.id) {
      throw new ForbiddenException("Só quem criou a avaliação pode editá-la.");
    }
    if (!hasPermission(user, PERMISSIONS.ASSESSMENTS_EDIT_OWN)) {
      throw new ForbiddenException("Sem permissão para editar avaliações.");
    }
    if (!EDITABLE_STATUSES.includes(assessment.status)) {
      throw new BadRequestException(
        `Avaliação em status "${assessment.status}" não pode ser editada.`,
      );
    }
  }

  private async assertAreaInTenant(tenantId: string, areaId: string): Promise<void> {
    const areas = await this.areasService.findAllActive(tenantId);
    if (!areas.some((area) => area.id === areaId)) {
      throw new BadRequestException("Área inválida para este tenant.");
    }
  }

  private async assertAreaNotBlocked(tenantId: string, areaId: string): Promise<void> {
    const blocked = await this.assessmentsRepository.isAreaBlocked(tenantId, areaId);
    if (blocked) {
      throw new ConflictException({
        message:
          "Esta área está com novas submissões bloqueadas até que as pendências de renovação anual sejam resolvidas. Um Administrador pode reatribuir o solicitante da renovação pendente.",
        error: "AREA_BLOCKED",
      });
    }
  }

  private async assertUserInTenant(tenantId: string, userId: string): Promise<void> {
    const target = await this.usersService.findById(userId);
    if (!target || target.tenantId !== tenantId) {
      throw new BadRequestException("Usuário responsável inválido para este tenant.");
    }
  }

  private async nextVersionLabel(assessmentId: string): Promise<string> {
    const count = await this.assessmentsRepository.countVersions(assessmentId);
    if (count === 0) return "v1.0";
    return `v1.${count}`;
  }

  private assertQuestionnaireComplete(
    questions: QuestionWithOptions[],
    answers: AnswerWithOptions[],
  ): void {
    const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));
    const missing: string[] = [];

    for (const question of questions) {
      if (!question.isRequired) continue;
      const answer = answerByQuestionId.get(question.id);
      const isAnswered =
        question.type === "TEXT"
          ? Boolean(answer?.textValue?.trim())
          : question.type === "SCALE"
            ? answer?.scaleValue !== null && answer?.scaleValue !== undefined
            : (answer?.selectedOptions.length ?? 0) > 0;

      if (!isAnswered) missing.push(question.text);
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Existem perguntas obrigatórias sem resposta: ${missing.join("; ")}`,
      );
    }
  }

  /**
   * Fecha a lacuna de `AttachmentCategory.SOC2_REPORT`/`ISO27001_CERTIFICATE`/`DPIA`
   * existirem no schema sem nenhum enforcement até aqui - se declarado (ou, no
   * caso de DPIA, se a avaliação envolve LGPD), exige que o anexo
   * correspondente já tenha sido enviado antes do envio para análise.
   */
  private assertComplianceEvidence(
    assessment: Pick<AssessmentDetail, "hasSoc2Report" | "hasIso27001Certificate">,
    attachments: AttachmentDetail[],
    involvesLgpd: boolean,
  ): void {
    const hasCategory = (category: AttachmentCategory) =>
      attachments.some((attachment) => attachment.category === category);

    const missing: string[] = [];
    if (assessment.hasSoc2Report && !hasCategory("SOC2_REPORT")) {
      missing.push("Relatório SOC 2 declarado, mas sem anexo na categoria correspondente");
    }
    if (assessment.hasIso27001Certificate && !hasCategory("ISO27001_CERTIFICATE")) {
      missing.push("Certificado ISO 27001 declarado, mas sem anexo na categoria correspondente");
    }
    if (involvesLgpd && !hasCategory("DPIA")) {
      missing.push("Avaliação envolve dados pessoais (LGPD) e exige um anexo de DPIA");
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Existe evidência de conformidade pendente: ${missing.join("; ")}.`,
      );
    }
  }

  /**
   * Converte respostas para a entrada do motor de risco. Perguntas TEXT não
   * têm score numérico e são ignoradas; SCALE usa `scaleValue` diretamente;
   * SINGLE_CHOICE/MULTI_CHOICE usam a média dos `score` das opções
   * selecionadas (já carregadas via `answer.selectedOptions[].questionOption`,
   * sem precisar cruzar com a lista de `questions` por opção).
   */
  private resolveScorableAnswers(
    questions: QuestionWithOptions[],
    answers: AnswerWithOptions[],
  ): ScorableAnswer[] {
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const scorable: ScorableAnswer[] = [];

    for (const answer of answers) {
      const question = questionById.get(answer.questionId);
      if (!question || question.type === "TEXT") continue;

      let score: number | null = null;
      if (question.type === "SCALE") {
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
        riskDimension: question.riskDimension as RiskDimensionInput,
        weight: Number(question.weight),
        score,
      });
    }

    return scorable;
  }
}
