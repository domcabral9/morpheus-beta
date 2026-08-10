import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { IntegrationsPolicyService } from "./integrations-policy.service";
import {
  IntegrationsPolicyRepository,
  IntegrationsPolicyUpdateData,
} from "./integrations-policy.repository";
import { CryptoService } from "../../common/services/crypto/crypto.service";
import { AuditLogService } from "../audit/audit-log.service";

const CONFIG_VALUES: Record<string, string> = {
  ENCRYPTION_KEY: "2CJIB+zn5Gu5HfqYYlyTMFeEnzaTwfg+Ta5TLf8WoMk=",
};

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "singleton",
    virusTotalApiKeyEncrypted: null,
    virusTotalEnabled: false,
    virusTotalDailyBudget: 450,
    endoflifeEnabled: true,
    internetDbEnabled: true,
    updatedByUserId: null,
    updatedAt: new Date("2026-08-08T00:00:00.000Z"),
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    ...overrides,
  };
}

describe("IntegrationsPolicyService", () => {
  let service: IntegrationsPolicyService;
  let cryptoService: CryptoService;
  let repo: { getOrCreate: jest.Mock; update: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = { getOrCreate: jest.fn(), update: jest.fn() };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IntegrationsPolicyService,
        { provide: IntegrationsPolicyRepository, useValue: repo },
        { provide: ConfigService, useValue: { getOrThrow: (key: string) => CONFIG_VALUES[key] } },
        CryptoService,
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();
    cryptoService = moduleRef.get(CryptoService);

    service = moduleRef.get(IntegrationsPolicyService);
  });

  describe("getPolicy", () => {
    it("nunca inclui a chave criptografada nem um campo equivalente na resposta", async () => {
      repo.getOrCreate.mockResolvedValue(
        makeRow({ virusTotalApiKeyEncrypted: "iv.tag.ciphertext" }),
      );

      const view = await service.getPolicy();

      expect(view).toEqual({
        virusTotalEnabled: false,
        virusTotalDailyBudget: 450,
        hasVirusTotalApiKey: true,
        endoflifeEnabled: true,
        internetDbEnabled: true,
        updatedByUserId: null,
        updatedAt: expect.any(Date),
      });
      expect(JSON.stringify(view)).not.toMatch(/iv\.tag\.ciphertext/);
      expect(Object.keys(view)).not.toContain("virusTotalApiKeyEncrypted");
    });

    it("hasVirusTotalApiKey é false quando nenhuma chave foi configurada", async () => {
      repo.getOrCreate.mockResolvedValue(makeRow());
      const view = await service.getPolicy();
      expect(view.hasVirusTotalApiKey).toBe(false);
    });
  });

  describe("updatePolicy", () => {
    it("criptografa a chave nova antes de persistir e nunca a expõe de volta", async () => {
      repo.update.mockImplementation((data: IntegrationsPolicyUpdateData) =>
        Promise.resolve(makeRow({ ...data, updatedByUserId: "admin-1" })),
      );

      const view = await service.updatePolicy({ virusTotalApiKey: "vt-real-key-value" }, "admin-1");

      const [persistedData] = repo.update.mock.calls[0];
      expect(persistedData.virusTotalApiKeyEncrypted).toBeDefined();
      expect(persistedData.virusTotalApiKeyEncrypted).not.toContain("vt-real-key-value");
      expect(view.hasVirusTotalApiKey).toBe(true);
      expect(JSON.stringify(view)).not.toMatch(/vt-real-key-value/);
    });

    it("preserva a chave existente quando omitida do payload (não sobrescreve com vazio)", async () => {
      repo.update.mockImplementation((data: IntegrationsPolicyUpdateData) =>
        Promise.resolve(makeRow(data as Record<string, unknown>)),
      );

      await service.updatePolicy({ virusTotalEnabled: true }, "admin-1");

      const [persistedData] = repo.update.mock.calls[0];
      expect(persistedData).not.toHaveProperty("virusTotalApiKeyEncrypted");
      expect(persistedData.virusTotalEnabled).toBe(true);
    });

    it("atualiza internetDbEnabled quando presente e preserva o resto quando omitido", async () => {
      repo.update.mockImplementation((data: IntegrationsPolicyUpdateData) =>
        Promise.resolve(makeRow(data as Record<string, unknown>)),
      );

      const view = await service.updatePolicy({ internetDbEnabled: false }, "admin-1");

      const [persistedData] = repo.update.mock.calls[0];
      expect(persistedData).toEqual({ internetDbEnabled: false });
      expect(view.internetDbEnabled).toBe(false);
    });

    it("audita a mudança sem incluir a chave crua no metadata", async () => {
      repo.update.mockImplementation((data: IntegrationsPolicyUpdateData) =>
        Promise.resolve(makeRow(data as Record<string, unknown>)),
      );

      await service.updatePolicy(
        { virusTotalApiKey: "vt-real-key-value", virusTotalEnabled: true },
        "admin-1",
      );

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
          userId: "admin-1",
          action: "UPDATE",
          entityType: "PlatformIntegrationsPolicy",
          metadata: expect.objectContaining({ keyChanged: true, virusTotalEnabled: true }),
        }),
      );
      const [[auditCall]] = auditLogService.record.mock.calls;
      expect(JSON.stringify(auditCall.metadata)).not.toMatch(/vt-real-key-value/);
    });
  });

  describe("getDecryptedVirusTotalApiKey", () => {
    it("devolve null quando nenhuma chave foi configurada", async () => {
      repo.getOrCreate.mockResolvedValue(makeRow());
      expect(await service.getDecryptedVirusTotalApiKey()).toBeNull();
    });

    it("descriptografa e devolve o valor real quando há chave configurada", async () => {
      const encrypted = cryptoService.encrypt("chave-real");
      repo.getOrCreate.mockResolvedValue(makeRow({ virusTotalApiKeyEncrypted: encrypted }));
      expect(await service.getDecryptedVirusTotalApiKey()).toBe("chave-real");
    });
  });
});
