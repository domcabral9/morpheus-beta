import { Injectable } from "@nestjs/common";
import { Prisma } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const opinionContextAssessmentInclude = {
  area: true,
  responsible: { select: { id: true, name: true, email: true } },
  requester: { select: { id: true, name: true, email: true } },
  tenant: true,
} satisfies Prisma.AssessmentInclude;

export type OpinionContextAssessment = Prisma.AssessmentGetPayload<{
  include: typeof opinionContextAssessmentInclude;
}>;

const riskResultDetailInclude = {
  probabilityLevel: true,
  impactLevel: true,
  riskClassification: true,
} satisfies Prisma.RiskResultInclude;

export type RiskResultDetail = Prisma.RiskResultGetPayload<{
  include: typeof riskResultDetailInclude;
}>;

const stepExecutionForOpinionInclude = {
  workflowStep: { include: { responsibleRole: true } },
  decidedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.WorkflowStepExecutionInclude;

export type StepExecutionForOpinion = Prisma.WorkflowStepExecutionGetPayload<{
  include: typeof stepExecutionForOpinionInclude;
}>;

const answerForOpinionInclude = {
  question: { include: { category: true } },
  selectedOptions: { include: { questionOption: true } },
} satisfies Prisma.AssessmentAnswerInclude;

export type AnswerForOpinion = Prisma.AssessmentAnswerGetPayload<{
  include: typeof answerForOpinionInclude;
}>;

const technicalOpinionListInclude = {
  assessmentVersion: {
    select: {
      assessment: { select: { id: true, softwareName: true, vendor: true } },
    },
  },
  issuedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TechnicalOpinionInclude;

export type TechnicalOpinionListItem = Prisma.TechnicalOpinionGetPayload<{
  include: typeof technicalOpinionListInclude;
}>;

export interface TechnicalOpinionFilters {
  tenantId: string;
  /** Sem permissão de visão ampla: só pareceres de avaliações que o próprio usuário solicitou. */
  requesterId?: string;
  assessmentId?: string;
  issuedById?: string;
  classificationLabel?: string;
  number?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class TechnicalOpinionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForTenant(
    filters: TechnicalOpinionFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: TechnicalOpinionListItem[]; total: number }> {
    const where: Prisma.TechnicalOpinionWhereInput = {
      tenantId: filters.tenantId,
      ...(filters.requesterId
        ? { assessmentVersion: { assessment: { requesterId: filters.requesterId } } }
        : {}),
      ...(filters.assessmentId
        ? { assessmentVersion: { assessmentId: filters.assessmentId } }
        : {}),
      ...(filters.issuedById ? { issuedById: filters.issuedById } : {}),
      ...(filters.classificationLabel ? { classificationLabel: filters.classificationLabel } : {}),
      ...(filters.number ? { number: { startsWith: filters.number } } : {}),
      ...(filters.from || filters.to
        ? { issuedAt: { gte: filters.from, lte: filters.to } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.technicalOpinion.findMany({
        where,
        include: technicalOpinionListInclude,
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.technicalOpinion.count({ where }),
    ]);

    return { items, total };
  }

  findAssessmentContext(assessmentId: string): Promise<OpinionContextAssessment | null> {
    return this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: opinionContextAssessmentInclude,
    });
  }

  findLatestVersion(assessmentId: string) {
    return this.prisma.assessmentVersion.findFirst({
      where: { assessmentId },
      orderBy: { createdAt: "desc" },
    });
  }

  findRiskResult(assessmentVersionId: string): Promise<RiskResultDetail | null> {
    return this.prisma.riskResult.findUnique({
      where: { assessmentVersionId },
      include: riskResultDetailInclude,
    });
  }

  /** Histórico completo de decisões desta avaliação, na ordem das etapas. */
  findWorkflowHistory(assessmentId: string): Promise<StepExecutionForOpinion[]> {
    return this.prisma.workflowStepExecution.findMany({
      where: { assessmentWorkflowInstance: { assessmentId } },
      include: stepExecutionForOpinionInclude,
      orderBy: [{ workflowStep: { order: "asc" } }, { createdAt: "asc" }],
    });
  }

  /** Respostas atuais, agrupadas por categoria — seguro usar dados "ao vivo" aqui
   * porque a avaliação fica travada para edição (EDITABLE_STATUSES) desde o
   * envio, então elas já refletem exatamente a versão sendo decidida. */
  findAnswers(assessmentId: string): Promise<AnswerForOpinion[]> {
    return this.prisma.assessmentAnswer.findMany({
      where: { assessmentId },
      include: answerForOpinionInclude,
      orderBy: [{ question: { category: { order: "asc" } } }, { question: { order: "asc" } }],
    });
  }

  countForTenantAndPeriod(tenantId: string, prefix: string, period: string): Promise<number> {
    return this.prisma.technicalOpinion.count({
      where: { tenantId, number: { startsWith: `${prefix}-${period}-` } },
    });
  }

  create(data: Prisma.TechnicalOpinionUncheckedCreateInput) {
    return this.prisma.technicalOpinion.create({ data });
  }

  findById(id: string) {
    return this.prisma.technicalOpinion.findUnique({ where: { id } });
  }

  findByAssessmentVersionId(assessmentVersionId: string) {
    return this.prisma.technicalOpinion.findUnique({ where: { assessmentVersionId } });
  }

  findLatestForAssessment(assessmentId: string) {
    return this.prisma.technicalOpinion.findFirst({
      where: { assessmentVersion: { assessmentId } },
      orderBy: { issuedAt: "desc" },
    });
  }

  findByTenantAndNumber(tenantId: string, number: string) {
    return this.prisma.technicalOpinion.findUnique({
      where: { tenantId_number: { tenantId, number } },
    });
  }

  /** Usado pela verificação pública (via QR Code) — não expõe tenantId, só o slug. */
  findByTenantSlugAndNumber(tenantSlug: string, number: string) {
    return this.prisma.technicalOpinion.findFirst({
      where: { number, tenant: { slug: tenantSlug } },
    });
  }

  /** Contexto mínimo para autorizar o download: a que avaliação/tenant este parecer pertence. */
  async findAuthorizationContext(
    id: string,
  ): Promise<{ tenantId: string; assessmentId: string } | null> {
    const row = await this.prisma.technicalOpinion.findUnique({
      where: { id },
      select: { tenantId: true, assessmentVersion: { select: { assessmentId: true } } },
    });
    return row
      ? { tenantId: row.tenantId, assessmentId: row.assessmentVersion.assessmentId }
      : null;
  }
}
