import { Injectable } from "@nestjs/common";
import { Prisma, AssessmentStatus } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const assessmentDetailInclude = {
  area: true,
  responsible: { select: { id: true, name: true, email: true } },
  requester: { select: { id: true, name: true, email: true } },
  versions: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.AssessmentInclude;

export type AssessmentDetail = Prisma.AssessmentGetPayload<{
  include: typeof assessmentDetailInclude;
}>;

const answerWithOptionsInclude = {
  selectedOptions: { include: { questionOption: true } },
} satisfies Prisma.AssessmentAnswerInclude;

export type AnswerWithOptions = Prisma.AssessmentAnswerGetPayload<{
  include: typeof answerWithOptionsInclude;
}>;

@Injectable()
export class AssessmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AssessmentUncheckedCreateInput): Promise<AssessmentDetail> {
    return this.prisma.assessment.create({ data, include: assessmentDetailInclude });
  }

  findById(id: string): Promise<AssessmentDetail | null> {
    return this.prisma.assessment.findUnique({ where: { id }, include: assessmentDetailInclude });
  }

  async findMany(params: {
    tenantId: string;
    requesterId?: string;
    status?: AssessmentStatus;
    page: number;
    pageSize: number;
  }): Promise<{ items: AssessmentDetail[]; total: number }> {
    const where: Prisma.AssessmentWhereInput = {
      tenantId: params.tenantId,
      ...(params.requesterId ? { requesterId: params.requesterId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        include: assessmentDetailInclude,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.assessment.count({ where }),
    ]);

    return { items, total };
  }

  update(id: string, data: Prisma.AssessmentUncheckedUpdateInput): Promise<AssessmentDetail> {
    return this.prisma.assessment.update({ where: { id }, data, include: assessmentDetailInclude });
  }

  findAnswers(assessmentId: string): Promise<AnswerWithOptions[]> {
    return this.prisma.assessmentAnswer.findMany({
      where: { assessmentId },
      include: answerWithOptionsInclude,
    });
  }

  async upsertAnswers(
    assessmentId: string,
    answers: Array<{
      questionId: string;
      textValue?: string;
      scaleValue?: number;
      selectedOptionIds?: string[];
    }>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const answer of answers) {
        const record = await tx.assessmentAnswer.upsert({
          where: { assessmentId_questionId: { assessmentId, questionId: answer.questionId } },
          update: {
            textValue: answer.textValue ?? null,
            scaleValue: answer.scaleValue ?? null,
          },
          create: {
            assessmentId,
            questionId: answer.questionId,
            textValue: answer.textValue ?? null,
            scaleValue: answer.scaleValue ?? null,
          },
        });

        if (answer.selectedOptionIds) {
          await tx.assessmentAnswerOption.deleteMany({ where: { assessmentAnswerId: record.id } });
          if (answer.selectedOptionIds.length > 0) {
            await tx.assessmentAnswerOption.createMany({
              data: answer.selectedOptionIds.map((questionOptionId) => ({
                assessmentAnswerId: record.id,
                questionOptionId,
              })),
            });
          }
        }
      }
    });
  }

  countVersions(assessmentId: string): Promise<number> {
    return this.prisma.assessmentVersion.count({ where: { assessmentId } });
  }

  createVersion(data: Prisma.AssessmentVersionUncheckedCreateInput) {
    return this.prisma.assessmentVersion.create({ data });
  }
}
