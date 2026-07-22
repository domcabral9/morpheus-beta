import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AssessmentStatus } from "@morpheus/database";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AreasService } from "../areas/areas.service";
import { UsersService } from "../users/users.service";
import { QuestionnaireService } from "../questionnaire/questionnaire.service";
import { RiskEvaluationService } from "../risk-engine/risk-evaluation.service";
import type { RiskDimensionInput, ScorableAnswer } from "../risk-engine/risk-engine.service";
import { WorkflowService } from "../workflow/workflow.service";
import { AuditLogService } from "../audit/audit-log.service";
import {
  AssessmentsRepository,
  AssessmentDetail,
  AnswerWithOptions,
  VersionWithDetails,
} from "./assessments.repository";
import { CreateAssessmentDto } from "./dto/create-assessment.dto";
import { UpdateAssessmentDto } from "./dto/update-assessment.dto";
import { SubmitAnswersDto } from "./dto/submit-answers.dto";
import { ListAssessmentsQueryDto } from "./dto/list-assessments.query.dto";
import type { QuestionWithOptions } from "../questionnaire/questionnaire.repository";

const EDITABLE_STATUSES: AssessmentStatus[] = ["DRAFT", "PENDING_ADJUSTMENT"];

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
  ) {}

  async create(user: AuthenticatedUser, dto: CreateAssessmentDto): Promise<AssessmentDetail> {
    await this.assertAreaInTenant(user.tenantId, dto.areaId);
    await this.assertUserInTenant(user.tenantId, dto.responsibleId);

    return this.assessmentsRepository.create({
      tenantId: user.tenantId,
      softwareName: dto.softwareName,
      vendor: dto.vendor,
      version: dto.version,
      url: dto.url,
      responsibleId: dto.responsibleId,
      areaId: dto.areaId,
      criticality: dto.criticality,
      justification: dto.justification,
      linkedTicket: dto.linkedTicket,
      installerFileHash: dto.installerFileHash,
      requesterId: user.id,
      status: "DRAFT",
    });
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

  async findOneForUser(user: AuthenticatedUser, id: string): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    this.assertCanView(user, assessment);
    return assessment;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateAssessmentDto,
  ): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    this.assertCanEdit(user, assessment);

    if (dto.areaId) {
      await this.assertAreaInTenant(user.tenantId, dto.areaId);
    }
    if (dto.responsibleId) {
      await this.assertUserInTenant(user.tenantId, dto.responsibleId);
    }

    return this.assessmentsRepository.update(id, dto);
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

    const versionLabel = await this.nextVersionLabel(id);

    const version = await this.assessmentsRepository.createVersion({
      assessmentId: id,
      versionLabel,
      changeReason:
        assessment.status === "PENDING_ADJUSTMENT" ? "Reenvio após ajuste" : "Envio inicial",
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

  async getVersionHistory(user: AuthenticatedUser, id: string): Promise<VersionWithDetails[]> {
    const assessment = await this.getOwnedOrThrow(user.tenantId, id);
    this.assertCanView(user, assessment);
    return this.assessmentsRepository.findVersionsWithDetails(id);
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
