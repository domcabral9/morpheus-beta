import { Test } from "@nestjs/testing";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { OneTimeCodePurpose } from "@morpheus/database";
import { EmailVerificationService } from "./email-verification.service";
import { OneTimeCodeRepository } from "./one-time-code.repository";
import { UsersService } from "../users/users.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogService } from "../audit/audit-log.service";
import { hashOneTimeCode, ONE_TIME_CODE_MAX_ATTEMPTS } from "./one-time-code.util";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

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

describe("EmailVerificationService", () => {
  let service: EmailVerificationService;
  let oneTimeCodeRepository: {
    createCode: jest.Mock;
    findActiveCode: jest.Mock;
    incrementAttempts: jest.Mock;
    markUsed: jest.Mock;
  };
  let usersService: { markEmailVerified: jest.Mock };
  let notificationsService: { sendRawEmail: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    oneTimeCodeRepository = {
      createCode: jest.fn().mockResolvedValue(undefined),
      findActiveCode: jest.fn(),
      incrementAttempts: jest.fn().mockResolvedValue(undefined),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
    usersService = { markEmailVerified: jest.fn().mockResolvedValue(undefined) };
    notificationsService = { sendRawEmail: jest.fn().mockResolvedValue(undefined) };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: OneTimeCodeRepository, useValue: oneTimeCodeRepository },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(EmailVerificationService);
  });

  describe("requestVerification", () => {
    it("cria um código com o propósito EMAIL_VERIFICATION e envia por e-mail", async () => {
      await service.requestVerification(makeActor());

      expect(oneTimeCodeRepository.createCode).toHaveBeenCalledWith(
        "user-1",
        OneTimeCodePurpose.EMAIL_VERIFICATION,
        expect.any(String),
        expect.any(Date),
      );
      expect(notificationsService.sendRawEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "ana@example.com" }),
      );
    });

    it("nunca envia o código em claro no corpo do e-mail sem hash-lo antes de persistir", async () => {
      await service.requestVerification(makeActor());
      const [, , codeHash] = oneTimeCodeRepository.createCode.mock.calls[0];
      const [emailArgs] = notificationsService.sendRawEmail.mock.calls[0] as [{ html: string }];
      const sentCodeMatch = /<strong>(\d{6})<\/strong>/.exec(emailArgs.html);
      const sentCode = sentCodeMatch?.[1];
      expect(sentCode).toEqual(expect.any(String));
      expect(codeHash).toBe(hashOneTimeCode(sentCode!));
    });
  });

  describe("confirmVerification", () => {
    it("rejeita quando não há código ativo pendente", async () => {
      oneTimeCodeRepository.findActiveCode.mockResolvedValue(null);
      await expect(service.confirmVerification(makeActor(), "123456")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejeita código errado e incrementa attempts", async () => {
      oneTimeCodeRepository.findActiveCode.mockResolvedValue({
        id: "code-1",
        codeHash: hashOneTimeCode("111111"),
        attempts: 0,
      });
      await expect(service.confirmVerification(makeActor(), "999999")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(oneTimeCodeRepository.incrementAttempts).toHaveBeenCalledWith("code-1");
      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
    });

    it("invalida o código ao atingir o limite de tentativas, mesmo com o código certo depois", async () => {
      oneTimeCodeRepository.findActiveCode.mockResolvedValue({
        id: "code-1",
        codeHash: hashOneTimeCode("111111"),
        attempts: ONE_TIME_CODE_MAX_ATTEMPTS,
      });
      await expect(service.confirmVerification(makeActor(), "111111")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(oneTimeCodeRepository.markUsed).toHaveBeenCalledWith("code-1");
      expect(usersService.markEmailVerified).not.toHaveBeenCalled();
    });

    it("código certo marca o e-mail verificado e audita", async () => {
      oneTimeCodeRepository.findActiveCode.mockResolvedValue({
        id: "code-1",
        codeHash: hashOneTimeCode("111111"),
        attempts: 0,
      });
      await service.confirmVerification(makeActor(), "111111");

      expect(oneTimeCodeRepository.markUsed).toHaveBeenCalledWith("code-1");
      expect(usersService.markEmailVerified).toHaveBeenCalledWith("user-1");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          action: "UPDATE",
          entityType: "User",
          metadata: { field: "emailVerified", initiatedBy: "self" },
        }),
      );
    });
  });
});
