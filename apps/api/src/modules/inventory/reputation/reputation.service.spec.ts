import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ReputationService, ReputationBudgetExhaustedException } from "./reputation.service";
import { AttachmentsRepository } from "../../attachments/attachments.repository";
import { STORAGE_ADAPTER } from "../../storage/storage.interface";
import { IntegrationsPolicyService } from "../../platform-policy/integrations-policy.service";
import { InventoryRepository } from "../inventory.repository";
import { VirusTotalClient } from "./virustotal.client";
import { ReputationBudgetRepository } from "./reputation-budget.repository";
import { AuditLogService } from "../../audit/audit-log.service";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    tenantId: "tenant-1",
    url: null,
    ...overrides,
  } as never;
}

describe("ReputationService", () => {
  let service: ReputationService;
  let repository: { update: jest.Mock };
  let attachmentsRepository: { findMany: jest.Mock };
  let storage: { read: jest.Mock };
  let virusTotalClient: { checkHash: jest.Mock; checkUrl: jest.Mock };
  let budgetRepository: { tryConsume: jest.Mock };
  let integrationsPolicyService: { getPolicy: jest.Mock; getDecryptedVirusTotalApiKey: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repository = {
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    };
    attachmentsRepository = { findMany: jest.fn().mockResolvedValue([]) };
    storage = { read: jest.fn() };
    virusTotalClient = { checkHash: jest.fn(), checkUrl: jest.fn() };
    budgetRepository = { tryConsume: jest.fn().mockResolvedValue(true) };
    integrationsPolicyService = {
      getPolicy: jest
        .fn()
        .mockResolvedValue({ virusTotalEnabled: true, virusTotalDailyBudget: 450 }),
      getDecryptedVirusTotalApiKey: jest.fn().mockResolvedValue("fake-key"),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReputationService,
        { provide: InventoryRepository, useValue: repository },
        { provide: AttachmentsRepository, useValue: attachmentsRepository },
        { provide: STORAGE_ADAPTER, useValue: storage },
        { provide: VirusTotalClient, useValue: virusTotalClient },
        { provide: ReputationBudgetRepository, useValue: budgetRepository },
        { provide: IntegrationsPolicyService, useValue: integrationsPolicyService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(ReputationService);
  });

  it("rejeita item sem URL e sem anexo", async () => {
    await expect(service.performCheck(makeItem(), "user-1")).rejects.toThrow(BadRequestException);
    expect(budgetRepository.tryConsume).not.toHaveBeenCalled();
  });

  it("rejeita quando a integração está desabilitada", async () => {
    integrationsPolicyService.getPolicy.mockResolvedValue({ virusTotalEnabled: false });
    await expect(
      service.performCheck(makeItem({ url: "https://example.com" }), "user-1"),
    ).rejects.toThrow(BadRequestException);
    expect(budgetRepository.tryConsume).not.toHaveBeenCalled();
  });

  it("lança ReputationBudgetExhaustedException quando o orçamento diário acabou", async () => {
    budgetRepository.tryConsume.mockResolvedValue(false);
    await expect(
      service.performCheck(makeItem({ url: "https://example.com" }), "user-1"),
    ).rejects.toThrow(ReputationBudgetExhaustedException);
    expect(virusTotalClient.checkUrl).not.toHaveBeenCalled();
  });

  it("usa hash de anexo com precedência sobre URL quando os dois existem", async () => {
    attachmentsRepository.findMany.mockResolvedValue([
      { id: "att-1", storageKey: "key-1", uploadedAt: new Date("2026-08-01") },
      { id: "att-2", storageKey: "key-2", uploadedAt: new Date("2026-08-05") },
    ]);
    storage.read.mockResolvedValue(Buffer.from("conteudo do arquivo"));
    virusTotalClient.checkHash.mockResolvedValue("CLEAN");

    await service.performCheck(makeItem({ url: "https://example.com" }), "user-1");

    expect(storage.read).toHaveBeenCalledWith("key-2"); // o anexo mais recente
    expect(virusTotalClient.checkHash).toHaveBeenCalled();
    expect(virusTotalClient.checkUrl).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({
        reputationCheckedSource: "ATTACHMENT_HASH",
        reputationCheckedAttachmentId: "att-2",
      }),
    );
  });

  it("usa URL quando não há nenhum anexo", async () => {
    virusTotalClient.checkUrl.mockResolvedValue("CLEAN");
    await service.performCheck(makeItem({ url: "https://example.com" }), "user-1");

    expect(virusTotalClient.checkUrl).toHaveBeenCalledWith("https://example.com", "fake-key");
    expect(repository.update).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({
        reputationCheckedSource: "URL",
        reputationCheckedAttachmentId: null,
      }),
    );
  });

  it("SHA-256 é computado a partir dos bytes reais do storage, nunca aceito de fora", async () => {
    attachmentsRepository.findMany.mockResolvedValue([
      { id: "att-1", storageKey: "key-1", uploadedAt: new Date() },
    ]);
    const knownContent = Buffer.from("conteudo conhecido");
    storage.read.mockResolvedValue(knownContent);
    virusTotalClient.checkHash.mockResolvedValue("CLEAN");

    await service.performCheck(makeItem(), "user-1");

    const expectedHash = createHash("sha256").update(knownContent).digest("hex");
    expect(virusTotalClient.checkHash).toHaveBeenCalledWith(expectedHash, "fake-key");
  });

  it("404/sem dado (null) do cliente nunca vira CLEAN - fica null (unverified) no registro salvo", async () => {
    virusTotalClient.checkUrl.mockResolvedValue(null);
    const updated = await service.performCheck(makeItem({ url: "https://example.com" }), "user-1");
    expect(updated.reputationVerdict).toBeNull();
  });

  it("audita com userId do ator (botão manual)", async () => {
    virusTotalClient.checkUrl.mockResolvedValue("CLEAN");
    await service.performCheck(makeItem({ url: "https://example.com" }), "user-1");
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        metadata: { field: "reputation", source: "URL", verdict: "CLEAN" },
      }),
    );
  });

  it("audita com userId null quando chamado pela varredura noturna (sem ator humano)", async () => {
    virusTotalClient.checkUrl.mockResolvedValue("CLEAN");
    await service.performCheck(makeItem({ url: "https://example.com" }), null);
    expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("metadata de auditoria nunca inclui a URL nem bytes do artefato", async () => {
    virusTotalClient.checkUrl.mockResolvedValue("CLEAN");
    await service.performCheck(makeItem({ url: "https://url-secreta.example/caminho" }), "user-1");
    const [[auditCall]] = auditLogService.record.mock.calls;
    expect(JSON.stringify(auditCall.metadata)).not.toMatch(/url-secreta/);
  });
});
