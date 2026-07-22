import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { TechnicalOpinionService } from "./technical-opinion.service";
import { TechnicalOpinionRepository } from "./technical-opinion.repository";
import { PdfGeneratorService } from "./pdf-generator.service";
import { STORAGE_ADAPTER } from "../storage/storage.interface";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr-png")),
}));

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    homeTenantId: "tenant-1",
    email: "user@example.com",
    name: "Usuário",
    permissions: [],
    isSuperAdmin: false,
    ...overrides,
  };
}

const assessmentContext = {
  id: "assessment-1",
  tenantId: "tenant-1",
  softwareName: "Sistema X",
  vendor: "Fornecedor X",
  version: null,
  url: null,
  criticality: "MEDIUM",
  justification: "Justificativa",
  linkedTicket: null,
  installerFileHash: "a".repeat(64),
  area: { name: "TI" },
  responsible: { id: "resp-1", name: "Responsável", email: "resp@example.com" },
  requester: { id: "requester-1", name: "Requester", email: "req@example.com" },
  tenant: {
    id: "tenant-1",
    slug: "demo",
    name: "Demo Tenant",
    logoUrl: null,
    securityTeamName: null,
    opinionNumberPrefix: "SECOPS-SW",
  },
} as never;

describe("TechnicalOpinionService", () => {
  let service: TechnicalOpinionService;
  let repo: {
    findAssessmentContext: jest.Mock;
    findLatestVersion: jest.Mock;
    findRiskResult: jest.Mock;
    findWorkflowHistory: jest.Mock;
    findAnswers: jest.Mock;
    countForTenantAndPeriod: jest.Mock;
    findByTenantAndNumber: jest.Mock;
    findByTenantSlugAndNumber: jest.Mock;
    findAuthorizationContext: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    findLatestForAssessment: jest.Mock;
  };
  let pdfGenerator: { build: jest.Mock };
  let storage: { save: jest.Mock; read: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let notificationsService: { notify: jest.Mock };

  beforeEach(async () => {
    repo = {
      findAssessmentContext: jest.fn().mockResolvedValue(assessmentContext),
      findLatestVersion: jest.fn().mockResolvedValue({ id: "version-1", versionLabel: "v1.0" }),
      findRiskResult: jest.fn().mockResolvedValue(null),
      findWorkflowHistory: jest.fn().mockResolvedValue([]),
      findAnswers: jest.fn().mockResolvedValue([]),
      countForTenantAndPeriod: jest.fn().mockResolvedValue(0),
      findByTenantAndNumber: jest.fn().mockResolvedValue(null),
      findByTenantSlugAndNumber: jest.fn(),
      findAuthorizationContext: jest.fn(),
      create: jest.fn().mockImplementation((data) => Promise.resolve({ id: "opinion-1", ...data })),
      findById: jest.fn(),
      findLatestForAssessment: jest.fn(),
    };
    pdfGenerator = { build: jest.fn().mockResolvedValue(Buffer.from("%PDF-fake")) };
    storage = { save: jest.fn().mockResolvedValue(undefined), read: jest.fn() };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    notificationsService = { notify: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TechnicalOpinionService,
        { provide: TechnicalOpinionRepository, useValue: repo },
        { provide: PdfGeneratorService, useValue: pdfGenerator },
        { provide: ConfigService, useValue: { get: () => "http://localhost:3001" } },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: STORAGE_ADAPTER, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(TechnicalOpinionService);
  });

  describe("generateForAssessment", () => {
    it("lança NotFoundException se a avaliação não existir", async () => {
      repo.findAssessmentContext.mockResolvedValue(null);
      await expect(
        service.generateForAssessment("tenant-1", "assessment-1", "APPROVED", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("lança UnprocessableEntityException se não houver versão enviada", async () => {
      repo.findLatestVersion.mockResolvedValue(null);
      await expect(
        service.generateForAssessment("tenant-1", "assessment-1", "APPROVED", "user-1"),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("gera o número no formato prefixo-periodo-sequencial e salva o PDF no storage", async () => {
      const opinion = await service.generateForAssessment(
        "tenant-1",
        "assessment-1",
        "APPROVED",
        "user-1",
      );

      expect(opinion.number).toMatch(/^SECOPS-SW-\d{6}-001$/);
      expect(storage.save).toHaveBeenCalledWith(
        "technical-opinions/tenant-1/version-1.pdf",
        expect.any(Buffer),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          assessmentVersionId: "version-1",
          hash: "a".repeat(64),
          issuedById: "user-1",
        }),
      );
    });

    it("usa risco/status como fallback de classificationLabel quando não há RiskResult", async () => {
      const opinion = await service.generateForAssessment(
        "tenant-1",
        "assessment-1",
        "REJECTED",
        "user-1",
      );
      expect(opinion.classificationLabel).toBe("Rejeitado");
    });

    it("tenta o próximo número se o candidato já existir (corrida)", async () => {
      // Simula uma corrida real: entre a primeira e a segunda tentativa, outro
      // parecer foi criado concorrentemente, então a contagem já subiu quando
      // o retry acontece — é isso que empurra o candidato de 001 para 002.
      repo.countForTenantAndPeriod.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      repo.findByTenantAndNumber
        .mockResolvedValueOnce({ id: "existing" }) // 001 já existe
        .mockResolvedValueOnce(null); // 002 livre

      const opinion = await service.generateForAssessment(
        "tenant-1",
        "assessment-1",
        "APPROVED",
        "user-1",
      );

      expect(opinion.number).toMatch(/-002$/);
    });
  });

  describe("getPdfForDownload", () => {
    beforeEach(() => {
      repo.findAuthorizationContext.mockResolvedValue({
        tenantId: "tenant-1",
        assessmentId: "assessment-1",
      });
      repo.findById.mockResolvedValue({ id: "opinion-1", storageKey: "key.pdf", number: "X-001" });
      storage.read.mockResolvedValue(Buffer.from("pdf-bytes"));
    });

    it("permite o requester baixar seu próprio parecer mesmo sem view-all/approve", async () => {
      const result = await service.getPdfForDownload(makeUser({ id: "requester-1" }), "opinion-1");
      expect(result.buffer.toString()).toBe("pdf-bytes");
    });

    it("bloqueia terceiros sem view-all/approve", async () => {
      await expect(
        service.getPdfForDownload(makeUser({ id: "outro-user" }), "opinion-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("bloqueia acesso de outro tenant", async () => {
      await expect(
        service.getPdfForDownload(makeUser({ tenantId: "outro-tenant" }), "opinion-1"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lança NotFoundException se o parecer não existir", async () => {
      repo.findAuthorizationContext.mockResolvedValue(null);
      await expect(service.getPdfForDownload(makeUser(), "inexistente")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("verify", () => {
    it("retorna valid=false se o número não existir para o tenant", async () => {
      repo.findByTenantSlugAndNumber.mockResolvedValue(null);
      const result = await service.verify("demo", "SECOPS-SW-072026-999");
      expect(result.valid).toBe(false);
    });

    it("retorna dados básicos quando o parecer existe", async () => {
      repo.findByTenantSlugAndNumber.mockResolvedValue({
        number: "SECOPS-SW-072026-001",
        classificationLabel: "Homologado",
        issuedAt: new Date("2026-07-20"),
      });
      const result = await service.verify("demo", "SECOPS-SW-072026-001");
      expect(result).toMatchObject({ valid: true, classificationLabel: "Homologado" });
    });
  });
});
