import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { QuestionCategory, QuestionOption } from "@morpheus/database";
import {
  QuestionnaireRepository,
  CategoryWithQuestions,
  QuestionWithOptions,
} from "./questionnaire.repository";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { QuestionOptionDto } from "./dto/question-option.dto";
import { UpdateQuestionOptionDto } from "./dto/update-question-option.dto";

const CHOICE_TYPES = new Set(["SINGLE_CHOICE", "MULTI_CHOICE"]);

@Injectable()
export class QuestionnaireService {
  constructor(private readonly questionnaireRepository: QuestionnaireRepository) {}

  // --- Leitura para responder --------------------------------------------------
  getCategories(tenantId: string): Promise<CategoryWithQuestions[]> {
    return this.questionnaireRepository.findActiveCategoriesWithQuestions(tenantId);
  }

  // --- Administração: categorias ------------------------------------------------
  listCategories(tenantId: string): Promise<QuestionCategory[]> {
    return this.questionnaireRepository.findAllCategories(tenantId);
  }

  createCategory(tenantId: string, dto: CreateCategoryDto): Promise<QuestionCategory> {
    return this.questionnaireRepository.createCategory({
      tenantId,
      name: dto.name,
      description: dto.description,
      order: dto.order ?? 0,
    });
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<QuestionCategory> {
    await this.assertCategoryInTenant(tenantId, id);
    return this.questionnaireRepository.updateCategory(id, dto);
  }

  // --- Administração: perguntas --------------------------------------------------
  listQuestions(tenantId: string): Promise<QuestionWithOptions[]> {
    return this.questionnaireRepository.findAllQuestions(tenantId);
  }

  async createQuestion(tenantId: string, dto: CreateQuestionDto): Promise<QuestionWithOptions> {
    await this.assertCategoryInTenant(tenantId, dto.categoryId);
    this.assertOptionsMatchType(dto.type, dto.options);

    return this.questionnaireRepository.createQuestion(
      tenantId,
      {
        categoryId: dto.categoryId,
        text: dto.text,
        description: dto.description,
        weight: dto.weight,
        type: dto.type,
        riskDimension: dto.riskDimension,
        order: dto.order ?? 0,
        isRequired: dto.isRequired ?? true,
      },
      dto.options,
    );
  }

  async updateQuestion(
    tenantId: string,
    id: string,
    dto: UpdateQuestionDto,
  ): Promise<QuestionWithOptions> {
    const question = await this.assertQuestionInTenant(tenantId, id);

    if (dto.categoryId) {
      await this.assertCategoryInTenant(tenantId, dto.categoryId);
    }
    if (dto.type) {
      this.assertOptionsMatchType(dto.type, question.options);
    }

    return this.questionnaireRepository.updateQuestion(id, dto);
  }

  // --- Administração: opções -----------------------------------------------------
  async addOption(
    tenantId: string,
    questionId: string,
    dto: QuestionOptionDto,
  ): Promise<QuestionOption> {
    await this.assertQuestionInTenant(tenantId, questionId);
    return this.questionnaireRepository.addOption(questionId, dto);
  }

  async updateOption(
    tenantId: string,
    optionId: string,
    dto: UpdateQuestionOptionDto,
  ): Promise<QuestionOption> {
    await this.assertOptionInTenant(tenantId, optionId);
    return this.questionnaireRepository.updateOption(optionId, dto);
  }

  async removeOption(tenantId: string, optionId: string): Promise<void> {
    await this.assertOptionInTenant(tenantId, optionId);
    const usageCount = await this.questionnaireRepository.countAnswersUsingOption(optionId);
    if (usageCount > 0) {
      throw new BadRequestException(
        "Esta opção já foi usada em respostas de avaliações e não pode ser removida — desative a pergunta em vez disso.",
      );
    }
    await this.questionnaireRepository.deleteOption(optionId);
  }

  // --- Helpers de tenant scoping / integridade ------------------------------------
  private async assertCategoryInTenant(
    tenantId: string,
    categoryId: string,
  ): Promise<QuestionCategory> {
    const category = await this.questionnaireRepository.findCategoryById(categoryId);
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    if (category.tenantId !== tenantId) throw new ForbiddenException("Categoria de outro tenant.");
    return category;
  }

  private async assertQuestionInTenant(
    tenantId: string,
    questionId: string,
  ): Promise<QuestionWithOptions> {
    const question = await this.questionnaireRepository.findQuestionById(questionId);
    if (!question) throw new NotFoundException("Pergunta não encontrada.");
    if (question.tenantId !== tenantId) throw new ForbiddenException("Pergunta de outro tenant.");
    return question;
  }

  private async assertOptionInTenant(tenantId: string, optionId: string): Promise<QuestionOption> {
    const option = await this.questionnaireRepository.findOptionById(optionId);
    if (!option) throw new NotFoundException("Opção não encontrada.");
    await this.assertQuestionInTenant(tenantId, option.questionId);
    return option;
  }

  private assertOptionsMatchType(
    type: string,
    options: Array<{ label: string }> | undefined,
  ): void {
    if (CHOICE_TYPES.has(type) && (!options || options.length === 0)) {
      throw new BadRequestException(
        "Perguntas do tipo SINGLE_CHOICE/MULTI_CHOICE precisam de ao menos uma opção.",
      );
    }
  }
}
