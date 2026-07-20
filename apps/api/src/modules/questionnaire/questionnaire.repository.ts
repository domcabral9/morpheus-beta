import { Injectable } from "@nestjs/common";
import { Prisma, QuestionCategory, QuestionOption } from "@morpheus/database";
import { PrismaService } from "../../prisma/prisma.service";

const categoryWithQuestionsInclude = {
  questions: {
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      options: { orderBy: { order: "asc" } },
    },
  },
} satisfies Prisma.QuestionCategoryInclude;

export type CategoryWithQuestions = Prisma.QuestionCategoryGetPayload<{
  include: typeof categoryWithQuestionsInclude;
}>;

const questionWithOptionsInclude = {
  options: { orderBy: { order: "asc" } },
} satisfies Prisma.QuestionInclude;

export type QuestionWithOptions = Prisma.QuestionGetPayload<{
  include: typeof questionWithOptionsInclude;
}>;

@Injectable()
export class QuestionnaireRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Leitura para responder (só ativas) -----------------------------------
  findActiveCategoriesWithQuestions(tenantId: string): Promise<CategoryWithQuestions[]> {
    return this.prisma.questionCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: "asc" },
      include: categoryWithQuestionsInclude,
    });
  }

  findActiveQuestions(tenantId: string) {
    return this.prisma.question.findMany({
      where: { tenantId, isActive: true },
      include: { options: true },
    });
  }

  // --- Administração (inclui inativas) --------------------------------------
  findAllCategories(tenantId: string): Promise<QuestionCategory[]> {
    return this.prisma.questionCategory.findMany({
      where: { tenantId },
      orderBy: { order: "asc" },
    });
  }

  findCategoryById(id: string): Promise<QuestionCategory | null> {
    return this.prisma.questionCategory.findUnique({ where: { id } });
  }

  createCategory(data: Prisma.QuestionCategoryUncheckedCreateInput): Promise<QuestionCategory> {
    return this.prisma.questionCategory.create({ data });
  }

  updateCategory(
    id: string,
    data: Prisma.QuestionCategoryUncheckedUpdateInput,
  ): Promise<QuestionCategory> {
    return this.prisma.questionCategory.update({ where: { id }, data });
  }

  findAllQuestions(tenantId: string): Promise<QuestionWithOptions[]> {
    return this.prisma.question.findMany({
      where: { tenantId },
      orderBy: [{ categoryId: "asc" }, { order: "asc" }],
      include: questionWithOptionsInclude,
    });
  }

  findQuestionById(id: string): Promise<QuestionWithOptions | null> {
    return this.prisma.question.findUnique({
      where: { id },
      include: questionWithOptionsInclude,
    });
  }

  async createQuestion(
    tenantId: string,
    data: Omit<Prisma.QuestionUncheckedCreateInput, "tenantId">,
    options?: Array<{ label: string; value: string; score: number; order?: number }>,
  ): Promise<QuestionWithOptions> {
    const question = await this.prisma.question.create({
      data: {
        ...data,
        tenantId,
        options: options
          ? {
              create: options.map((option, index) => ({
                label: option.label,
                value: option.value,
                score: option.score,
                order: option.order ?? index,
              })),
            }
          : undefined,
      },
      include: questionWithOptionsInclude,
    });
    return question;
  }

  updateQuestion(
    id: string,
    data: Prisma.QuestionUncheckedUpdateInput,
  ): Promise<QuestionWithOptions> {
    return this.prisma.question.update({
      where: { id },
      data,
      include: questionWithOptionsInclude,
    });
  }

  addOption(
    questionId: string,
    data: { label: string; value: string; score: number; order?: number },
  ): Promise<QuestionOption> {
    return this.prisma.questionOption.create({
      data: { questionId, ...data },
    });
  }

  findOptionById(id: string): Promise<QuestionOption | null> {
    return this.prisma.questionOption.findUnique({ where: { id } });
  }

  updateOption(
    id: string,
    data: Prisma.QuestionOptionUncheckedUpdateInput,
  ): Promise<QuestionOption> {
    return this.prisma.questionOption.update({ where: { id }, data });
  }

  countAnswersUsingOption(optionId: string): Promise<number> {
    return this.prisma.assessmentAnswerOption.count({ where: { questionOptionId: optionId } });
  }

  deleteOption(id: string): Promise<QuestionOption> {
    return this.prisma.questionOption.delete({ where: { id } });
  }
}
