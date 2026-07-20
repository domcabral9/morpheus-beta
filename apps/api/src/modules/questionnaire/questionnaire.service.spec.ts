import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { QuestionnaireService } from "./questionnaire.service";
import { QuestionnaireRepository } from "./questionnaire.repository";
import { ControlsService } from "../controls/controls.service";

describe("QuestionnaireService", () => {
  let service: QuestionnaireService;
  let repo: {
    findCategoryById: jest.Mock;
    findQuestionById: jest.Mock;
    findOptionById: jest.Mock;
    createQuestion: jest.Mock;
    countAnswersUsingOption: jest.Mock;
    deleteOption: jest.Mock;
    linkControl: jest.Mock;
    unlinkControl: jest.Mock;
  };
  let controlsService: { findById: jest.Mock };

  beforeEach(async () => {
    repo = {
      findCategoryById: jest.fn(),
      findQuestionById: jest.fn(),
      findOptionById: jest.fn(),
      createQuestion: jest.fn(),
      countAnswersUsingOption: jest.fn(),
      deleteOption: jest.fn(),
      linkControl: jest.fn(),
      unlinkControl: jest.fn(),
    };
    controlsService = { findById: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        QuestionnaireService,
        { provide: QuestionnaireRepository, useValue: repo },
        { provide: ControlsService, useValue: controlsService },
      ],
    }).compile();

    service = moduleRef.get(QuestionnaireService);
  });

  describe("createQuestion", () => {
    it("rejeita categoria de outro tenant", async () => {
      repo.findCategoryById.mockResolvedValue({ id: "cat-1", tenantId: "outro-tenant" });
      await expect(
        service.createQuestion("tenant-1", {
          categoryId: "cat-1",
          text: "Pergunta",
          weight: 1,
          type: "TEXT",
          riskDimension: "BOTH",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("exige ao menos uma opção para SINGLE_CHOICE", async () => {
      repo.findCategoryById.mockResolvedValue({ id: "cat-1", tenantId: "tenant-1" });
      await expect(
        service.createQuestion("tenant-1", {
          categoryId: "cat-1",
          text: "Pergunta de escolha",
          weight: 1,
          type: "SINGLE_CHOICE",
          riskDimension: "BOTH",
          options: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("cria normalmente quando categoria é do tenant e opções presentes", async () => {
      repo.findCategoryById.mockResolvedValue({ id: "cat-1", tenantId: "tenant-1" });
      repo.createQuestion.mockResolvedValue({ id: "q-1" });

      const result = await service.createQuestion("tenant-1", {
        categoryId: "cat-1",
        text: "Pergunta de escolha",
        weight: 1,
        type: "SINGLE_CHOICE",
        riskDimension: "BOTH",
        options: [{ label: "Sim", value: "yes", score: 1 }],
      });

      expect(result).toEqual({ id: "q-1" });
    });
  });

  describe("removeOption", () => {
    it("bloqueia remoção de opção já usada em respostas", async () => {
      repo.findOptionById.mockResolvedValue({ id: "opt-1", questionId: "q-1" });
      repo.findQuestionById.mockResolvedValue({ id: "q-1", tenantId: "tenant-1" });
      repo.countAnswersUsingOption.mockResolvedValue(3);

      await expect(service.removeOption("tenant-1", "opt-1")).rejects.toThrow(BadRequestException);
      expect(repo.deleteOption).not.toHaveBeenCalled();
    });

    it("permite remoção de opção nunca usada", async () => {
      repo.findOptionById.mockResolvedValue({ id: "opt-1", questionId: "q-1" });
      repo.findQuestionById.mockResolvedValue({ id: "q-1", tenantId: "tenant-1" });
      repo.countAnswersUsingOption.mockResolvedValue(0);

      await service.removeOption("tenant-1", "opt-1");
      expect(repo.deleteOption).toHaveBeenCalledWith("opt-1");
    });

    it("404 quando a opção não existe", async () => {
      repo.findOptionById.mockResolvedValue(null);
      await expect(service.removeOption("tenant-1", "opt-inexistente")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("linkControl", () => {
    it("rejeita pergunta de outro tenant", async () => {
      repo.findQuestionById.mockResolvedValue({ id: "q-1", tenantId: "outro-tenant" });
      await expect(
        service.linkControl("tenant-1", "q-1", { controlId: "control-1" }),
      ).rejects.toThrow(ForbiddenException);
      expect(controlsService.findById).not.toHaveBeenCalled();
    });

    it("404 quando o controle não existe no catálogo", async () => {
      repo.findQuestionById.mockResolvedValue({ id: "q-1", tenantId: "tenant-1" });
      controlsService.findById.mockResolvedValue(null);
      await expect(
        service.linkControl("tenant-1", "q-1", { controlId: "control-inexistente" }),
      ).rejects.toThrow(NotFoundException);
      expect(repo.linkControl).not.toHaveBeenCalled();
    });

    it("vincula quando pergunta e controle existem", async () => {
      repo.findQuestionById.mockResolvedValue({ id: "q-1", tenantId: "tenant-1" });
      controlsService.findById.mockResolvedValue({ id: "control-1" });
      repo.linkControl.mockResolvedValue({ id: "q-1", controls: [{ controlId: "control-1" }] });

      const result = await service.linkControl("tenant-1", "q-1", { controlId: "control-1" });

      expect(repo.linkControl).toHaveBeenCalledWith("q-1", "control-1");
      expect(result).toEqual({ id: "q-1", controls: [{ controlId: "control-1" }] });
    });
  });

  describe("unlinkControl", () => {
    it("rejeita pergunta de outro tenant", async () => {
      repo.findQuestionById.mockResolvedValue({ id: "q-1", tenantId: "outro-tenant" });
      await expect(service.unlinkControl("tenant-1", "q-1", "control-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.unlinkControl).not.toHaveBeenCalled();
    });

    it("desvincula quando a pergunta é do tenant", async () => {
      repo.findQuestionById.mockResolvedValue({ id: "q-1", tenantId: "tenant-1" });
      await service.unlinkControl("tenant-1", "q-1", "control-1");
      expect(repo.unlinkControl).toHaveBeenCalledWith("q-1", "control-1");
    });
  });
});
