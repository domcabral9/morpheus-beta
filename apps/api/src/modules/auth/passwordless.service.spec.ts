import { Test } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { OneTimeCodePurpose } from "@morpheus/database";
import { PasswordlessService } from "./passwordless.service";
import { OneTimeCodeRepository } from "./one-time-code.repository";
import { UsersService } from "../users/users.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PasswordlessPolicyService } from "../platform-policy/passwordless-policy.service";
import { PrismaService } from "../../prisma/prisma.service";
import { hashOneTimeCode, ONE_TIME_CODE_MAX_ATTEMPTS } from "./one-time-code.util";
import type { UserWithPermissions } from "../users/users.repository";

const TENANT = { id: "tenant-1", slug: "demo" };

function makeUser(overrides: Partial<UserWithPermissions> = {}): UserWithPermissions {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    name: "Ana",
    email: "ana@example.com",
    avatarPath: null,
    passwordHash: "hash",
    ssoSubject: null,
    totpSecret: null,
    totpPendingSecret: null,
    totpEnabled: false,
    emailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissionKeys: [],
    ...overrides,
  } as UserWithPermissions;
}

describe("PasswordlessService", () => {
  let service: PasswordlessService;
  let oneTimeCodeRepository: {
    createCode: jest.Mock;
    findActiveCode: jest.Mock;
    incrementAttempts: jest.Mock;
    markUsed: jest.Mock;
  };
  let usersService: { findByEmail: jest.Mock };
  let notificationsService: { sendRawEmail: jest.Mock };
  let passwordlessPolicyService: { getPolicy: jest.Mock };
  let prisma: { tenant: { findUnique: jest.Mock } };

  beforeEach(async () => {
    oneTimeCodeRepository = {
      createCode: jest.fn().mockResolvedValue(undefined),
      findActiveCode: jest.fn(),
      incrementAttempts: jest.fn().mockResolvedValue(undefined),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
    usersService = { findByEmail: jest.fn() };
    notificationsService = { sendRawEmail: jest.fn().mockResolvedValue(undefined) };
    passwordlessPolicyService = { getPolicy: jest.fn().mockResolvedValue({ enabled: true }) };
    prisma = { tenant: { findUnique: jest.fn().mockResolvedValue(TENANT) } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordlessService,
        { provide: OneTimeCodeRepository, useValue: oneTimeCodeRepository },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PasswordlessPolicyService, useValue: passwordlessPolicyService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(PasswordlessService);
  });

  describe("requestLogin - anti-enumeração: nunca lança, nunca gera código quando inelegível", () => {
    it("toggle de plataforma desligado", async () => {
      passwordlessPolicyService.getPolicy.mockResolvedValue({ enabled: false });
      await service.requestLogin("demo", "ana@example.com");
      expect(oneTimeCodeRepository.createCode).not.toHaveBeenCalled();
      expect(notificationsService.sendRawEmail).not.toHaveBeenCalled();
    });

    it("tenant inexistente", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await service.requestLogin("naoexiste", "ana@example.com");
      expect(oneTimeCodeRepository.createCode).not.toHaveBeenCalled();
    });

    it("usuário inexistente", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await service.requestLogin("demo", "naoexiste@example.com");
      expect(oneTimeCodeRepository.createCode).not.toHaveBeenCalled();
    });

    it("usuário inativo", async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ isActive: false }));
      await service.requestLogin("demo", "ana@example.com");
      expect(oneTimeCodeRepository.createCode).not.toHaveBeenCalled();
    });

    it("e-mail não verificado", async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ emailVerified: false }));
      await service.requestLogin("demo", "ana@example.com");
      expect(oneTimeCodeRepository.createCode).not.toHaveBeenCalled();
    });

    it("conta elegível gera código e envia e-mail", async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      await service.requestLogin("demo", "ana@example.com");
      expect(oneTimeCodeRepository.createCode).toHaveBeenCalledWith(
        "user-1",
        OneTimeCodePurpose.PASSWORDLESS_LOGIN,
        expect.any(String),
        expect.any(Date),
      );
      expect(notificationsService.sendRawEmail).toHaveBeenCalled();
    });
  });

  describe("verifyLogin", () => {
    it("rejeita quando o toggle de plataforma está desligado, mesmo com código válido ainda dentro do prazo", async () => {
      passwordlessPolicyService.getPolicy.mockResolvedValue({ enabled: false });
      usersService.findByEmail.mockResolvedValue(makeUser());
      oneTimeCodeRepository.findActiveCode.mockResolvedValue({
        id: "code-1",
        codeHash: hashOneTimeCode("111111"),
        attempts: 0,
      });
      await expect(service.verifyLogin("demo", "ana@example.com", "111111")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(oneTimeCodeRepository.markUsed).not.toHaveBeenCalled();
    });

    it("rejeita com a mesma mensagem quando o tenant não existe", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.verifyLogin("naoexiste", "ana@example.com", "123456")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejeita quando não há código ativo", async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      oneTimeCodeRepository.findActiveCode.mockResolvedValue(null);
      await expect(service.verifyLogin("demo", "ana@example.com", "123456")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("código errado incrementa attempts e rejeita", async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      oneTimeCodeRepository.findActiveCode.mockResolvedValue({
        id: "code-1",
        codeHash: hashOneTimeCode("111111"),
        attempts: 0,
      });
      await expect(service.verifyLogin("demo", "ana@example.com", "999999")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(oneTimeCodeRepository.incrementAttempts).toHaveBeenCalledWith("code-1");
    });

    it("invalida o código ao atingir o limite de tentativas", async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      oneTimeCodeRepository.findActiveCode.mockResolvedValue({
        id: "code-1",
        codeHash: hashOneTimeCode("111111"),
        attempts: ONE_TIME_CODE_MAX_ATTEMPTS,
      });
      await expect(service.verifyLogin("demo", "ana@example.com", "111111")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(oneTimeCodeRepository.markUsed).toHaveBeenCalledWith("code-1");
    });

    it("código certo consome o código e devolve o usuário completo", async () => {
      const user = makeUser();
      usersService.findByEmail.mockResolvedValue(user);
      oneTimeCodeRepository.findActiveCode.mockResolvedValue({
        id: "code-1",
        codeHash: hashOneTimeCode("111111"),
        attempts: 0,
      });
      const result = await service.verifyLogin("demo", "ana@example.com", "111111");
      expect(oneTimeCodeRepository.markUsed).toHaveBeenCalledWith("code-1");
      expect(result).toBe(user);
    });

    it("nunca aceita login passwordless pra conta com e-mail não verificado, mesmo com código certo", async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ emailVerified: false }));
      await expect(service.verifyLogin("demo", "ana@example.com", "111111")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(oneTimeCodeRepository.findActiveCode).not.toHaveBeenCalled();
    });
  });
});
