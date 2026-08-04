import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { TwoFactorService } from "./two-factor.service";
import { TwoFactorRepository } from "./two-factor.repository";
import { CryptoService } from "../../common/services/crypto/crypto.service";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import type { UserWithPermissions } from "../users/users.repository";

const CONFIG_VALUES: Record<string, string> = {
  ENCRYPTION_KEY: "2CJIB+zn5Gu5HfqYYlyTMFeEnzaTwfg+Ta5TLf8WoMk=",
};

// Vetor de teste da RFC 6238 Apêndice B: secret ASCII "12345678901234567890"
// (Base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ), T=59s produz o código "287082"
// para truncamento de 6 dígitos - mesmo par usado em two-factor.util.spec.ts.
const FIXED_SECRET_BASE32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const FIXED_VALID_CODE = "287082";

function makeActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    homeTenantId: "tenant-1",
    email: "ana@example.com",
    name: "Ana",
    permissions: [],
    isSuperAdmin: false,
    ...overrides,
  };
}

describe("TwoFactorService", () => {
  let service: TwoFactorService;
  let cryptoService: CryptoService;
  let repo: {
    findTotpState: jest.Mock;
    setPendingSecret: jest.Mock;
    commitEnrollment: jest.Mock;
    disable: jest.Mock;
    replaceBackupCodes: jest.Mock;
    findUnusedBackupCodes: jest.Mock;
    markBackupCodeUsed: jest.Mock;
    deleteAllBackupCodes: jest.Mock;
  };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findTotpState: jest.fn(),
      setPendingSecret: jest.fn().mockResolvedValue(undefined),
      commitEnrollment: jest.fn().mockResolvedValue(undefined),
      disable: jest.fn().mockResolvedValue(undefined),
      replaceBackupCodes: jest.fn().mockResolvedValue(undefined),
      findUnusedBackupCodes: jest.fn().mockResolvedValue([]),
      markBackupCodeUsed: jest.fn().mockResolvedValue(undefined),
      deleteAllBackupCodes: jest.fn().mockResolvedValue(undefined),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: TwoFactorRepository, useValue: repo },
        { provide: ConfigService, useValue: { getOrThrow: (key: string) => CONFIG_VALUES[key] } },
        CryptoService,
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(TwoFactorService);
    cryptoService = moduleRef.get(CryptoService);
  });

  describe("beginSetup", () => {
    it("rejeita usuário SSO-only (sem senha local)", async () => {
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: null,
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabled: false,
      });
      await expect(service.beginSetup(makeActor())).rejects.toThrow(BadRequestException);
    });

    it("rejeita quando 2FA já está habilitado", async () => {
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: "hash",
        totpSecret: "encrypted",
        totpPendingSecret: null,
        totpEnabled: true,
      });
      await expect(service.beginSetup(makeActor())).rejects.toThrow(BadRequestException);
    });

    it("gera secret/QR e persiste o pendente criptografado", async () => {
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: "hash",
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabled: false,
      });

      const result = await service.beginSetup(makeActor());

      expect(result.secretBase32).toMatch(/^[A-Z2-7]+$/);
      expect(result.otpauthUri).toContain(result.secretBase32);
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(repo.setPendingSecret).toHaveBeenCalledWith("user-1", expect.any(String));
      const persisted: string = repo.setPendingSecret.mock.calls[0][1];
      expect(persisted).not.toBe(result.secretBase32);
      expect(cryptoService.decrypt(persisted)).toBe(result.secretBase32);
    });
  });

  describe("confirmSetup", () => {
    it("rejeita quando não há setup pendente", async () => {
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: "hash",
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabled: false,
      });
      await expect(service.confirmSetup(makeActor(), "123456")).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.commitEnrollment).not.toHaveBeenCalled();
    });

    it("rejeita código errado sem persistir nada", async () => {
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: "hash",
        totpSecret: null,
        totpPendingSecret: cryptoService.encrypt(FIXED_SECRET_BASE32),
        totpEnabled: false,
      });
      const originalNow = Date.now;
      Date.now = () => 59_000;
      try {
        await expect(service.confirmSetup(makeActor(), "000000")).rejects.toThrow(
          BadRequestException,
        );
      } finally {
        Date.now = originalNow;
      }
      expect(repo.commitEnrollment).not.toHaveBeenCalled();
      expect(repo.replaceBackupCodes).not.toHaveBeenCalled();
    });

    it("aceita código correto, comita o secret e devolve 10 backup codes únicos", async () => {
      const pending = cryptoService.encrypt(FIXED_SECRET_BASE32);
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: "hash",
        totpSecret: null,
        totpPendingSecret: pending,
        totpEnabled: false,
      });
      const originalNow = Date.now;
      Date.now = () => 59_000;
      try {
        const result = await service.confirmSetup(makeActor(), FIXED_VALID_CODE);
        expect(result.backupCodes).toHaveLength(10);
        expect(new Set(result.backupCodes).size).toBe(10);
      } finally {
        Date.now = originalNow;
      }
      expect(repo.commitEnrollment).toHaveBeenCalledWith("user-1", pending);
      expect(repo.replaceBackupCodes).toHaveBeenCalledWith(
        "user-1",
        expect.arrayContaining([expect.any(String)]),
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE",
          entityType: "User",
          metadata: { field: "twoFactor", event: "enabled" },
        }),
      );
    });
  });

  describe("disable", () => {
    it("rejeita senha atual incorreta", async () => {
      const hash = await bcrypt.hash("senha-correta", 4);
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: hash,
        totpSecret: "encrypted",
        totpPendingSecret: null,
        totpEnabled: true,
      });
      await expect(service.disable(makeActor(), "senha-errada")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(repo.disable).not.toHaveBeenCalled();
    });

    it("com senha correta, limpa o estado e apaga os backup codes", async () => {
      const hash = await bcrypt.hash("senha-correta", 4);
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: hash,
        totpSecret: "encrypted",
        totpPendingSecret: null,
        totpEnabled: true,
      });
      await service.disable(makeActor(), "senha-correta");
      expect(repo.disable).toHaveBeenCalledWith("user-1");
      expect(repo.deleteAllBackupCodes).toHaveBeenCalledWith("user-1");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { field: "twoFactor", event: "disabled" } }),
      );
    });
  });

  describe("regenerateBackupCodes", () => {
    it("rejeita quando 2FA não está habilitado", async () => {
      const hash = await bcrypt.hash("senha-correta", 4);
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: hash,
        totpSecret: null,
        totpPendingSecret: null,
        totpEnabled: false,
      });
      await expect(service.regenerateBackupCodes(makeActor(), "senha-correta")).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.replaceBackupCodes).not.toHaveBeenCalled();
    });

    it("com 2FA habilitado e senha correta, substitui o lote de códigos", async () => {
      const hash = await bcrypt.hash("senha-correta", 4);
      repo.findTotpState.mockResolvedValue({
        email: "ana@example.com",
        passwordHash: hash,
        totpSecret: "encrypted",
        totpPendingSecret: null,
        totpEnabled: true,
      });
      const result = await service.regenerateBackupCodes(makeActor(), "senha-correta");
      expect(result.backupCodes).toHaveLength(10);
      expect(repo.replaceBackupCodes).toHaveBeenCalledWith("user-1", expect.any(Array));
    });
  });

  describe("verifyLoginCode", () => {
    function makeUserWithSecret(totpSecret: string | null): UserWithPermissions {
      return {
        id: "user-1",
        tenantId: "tenant-1",
        name: "Ana",
        email: "ana@example.com",
        avatarPath: null,
        passwordHash: "hash",
        ssoSubject: null,
        totpSecret,
        totpPendingSecret: null,
        totpEnabled: true,
        emailVerified: false,
        emailVerifiedAt: null,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissionKeys: [],
      };
    }

    it("lança quando o usuário não tem totpSecret", async () => {
      await expect(service.verifyLoginCode(makeUserWithSecret(null), "287082")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("aceita o código TOTP correto", async () => {
      const encrypted = cryptoService.encrypt(FIXED_SECRET_BASE32);
      const originalNow = Date.now;
      Date.now = () => 59_000;
      try {
        const result = await service.verifyLoginCode(
          makeUserWithSecret(encrypted),
          FIXED_VALID_CODE,
        );
        expect(result).toEqual({ viaBackupCode: false });
      } finally {
        Date.now = originalNow;
      }
    });

    it("cai para um backup code válido e marca como usado", async () => {
      const encrypted = cryptoService.encrypt(FIXED_SECRET_BASE32);
      const backupHash = await bcrypt.hash("ABCD-1234", 4);
      repo.findUnusedBackupCodes.mockResolvedValue([{ id: "code-1", codeHash: backupHash }]);

      const result = await service.verifyLoginCode(makeUserWithSecret(encrypted), "ABCD-1234");

      expect(result).toEqual({ viaBackupCode: true });
      expect(repo.markBackupCodeUsed).toHaveBeenCalledWith("code-1");
    });

    it("rejeita quando nem TOTP nem nenhum backup code batem", async () => {
      const encrypted = cryptoService.encrypt(FIXED_SECRET_BASE32);
      repo.findUnusedBackupCodes.mockResolvedValue([]);
      await expect(
        service.verifyLoginCode(makeUserWithSecret(encrypted), "000000"),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.markBackupCodeUsed).not.toHaveBeenCalled();
    });
  });
});
