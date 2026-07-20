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
import { AssessmentsRepository, AssessmentDetail } from "./assessments.repository";
import { CreateAssessmentDto } from "./dto/create-assessment.dto";
import { UpdateAssessmentDto } from "./dto/update-assessment.dto";
import { SubmitAnswersDto } from "./dto/submit-answers.dto";
import { ListAssessmentsQueryDto } from "./dto/list-assessments.query.dto";

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
    const assessment = await this.getOwnedOrThrow(id);
    this.assertCanView(user, assessment);
    return assessment;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateAssessmentDto,
  ): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(id);
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
    const assessment = await this.getOwnedOrThrow(id);
    this.assertCanView(user, assessment);
    return this.assessmentsRepository.findAnswers(id);
  }

  async upsertAnswers(
    user: AuthenticatedUser,
    id: string,
    dto: SubmitAnswersDto,
  ): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(id);
    this.assertCanEdit(user, assessment);

    await this.assessmentsRepository.upsertAnswers(id, dto.answers);
    return this.getOwnedOrThrow(id);
  }

  async submit(user: AuthenticatedUser, id: string): Promise<AssessmentDetail> {
    const assessment = await this.getOwnedOrThrow(id);

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

    await this.assertQuestionnaireComplete(user.tenantId, id);

    const versionLabel = await this.nextVersionLabel(id);
    const answers = await this.assessmentsRepository.findAnswers(id);

    await this.assessmentsRepository.createVersion({
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

    return this.assessmentsRepository.update(id, { status: "SUBMITTED" });
  }

  // --- Helpers ------------------------------------------------------------------

  private async getOwnedOrThrow(id: string): Promise<AssessmentDetail> {
    const assessment = await this.assessmentsRepository.findById(id);
    if (!assessment) throw new NotFoundException("Avaliação não encontrada.");
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

  private async assertQuestionnaireComplete(tenantId: string, assessmentId: string): Promise<void> {
    const [questions, answers] = await Promise.all([
      this.questionnaireService
        .getCategories(tenantId)
        .then((categories) => categories.flatMap((category) => category.questions)),
      this.assessmentsRepository.findAnswers(assessmentId),
    ]);

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
}
