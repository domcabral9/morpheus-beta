import { Test } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";
import { RolesService } from "../roles/roles.service";
import { PasswordPolicyService } from "../platform-policy/password-policy.service";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    tenantId: "tenant-1",
    homeTenantId: "tenant-1",
    email: "a@b.com",
    name: "A",
    permissions: [],
    isSuperAdmin: false,
    ...overrides,
  };
}

const USER_ADMIN_RAW = {
  id: "user-1",
  tenantId: "tenant-1",
  name: "A",
  email: "a@b.com",
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  userRoles: [],
};

describe("UsersService", () => {
  let service: UsersService;
  let repo: {
    findByIdRaw: jest.Mock;
    findById: jest.Mock;
    setPasswordHash: jest.Mock;
  };
  let passwordPolicyService: { validate: jest.Mock };
  let auditLogService: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      findByIdRaw: jest.fn().mockResolvedValue(USER_ADMIN_RAW),
      findById: jest.fn(),
      setPasswordHash: jest.fn().mockResolvedValue(undefined),
    };
    passwordPolicyService = { validate: jest.fn().mockResolvedValue(undefined) };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repo },
        { provide: RolesService, useValue: {} },
        { provide: PasswordPolicyService, useValue: passwordPolicyService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe("setPassword", () => {
    it("rejeita usuário de outro tenant", async () => {
      repo.findByIdRaw.mockResolvedValue({ ...USER_ADMIN_RAW, tenantId: "tenant-2" });
      await expect(
        service.setPassword("tenant-1", "admin-1", "user-1", "Demo@12345"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("propaga a rejeição da política de senha sem chamar o repositório", async () => {
      passwordPolicyService.validate.mockRejectedValue(
        new BadRequestException("Mínimo de 8 caracteres."),
      );
      await expect(service.setPassword("tenant-1", "admin-1", "user-1", "abc")).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.setPasswordHash).not.toHaveBeenCalled();
    });

    it("com senha válida, hasheia, persiste e grava auditoria com initiatedBy admin", async () => {
      await service.setPassword("tenant-1", "admin-1", "user-1", "Demo@12345");

      expect(repo.setPasswordHash).toHaveBeenCalledWith("user-1", expect.any(String));
      const [, hash] = repo.setPasswordHash.mock.calls[0] as [string, string];
      await expect(bcrypt.compare("Demo@12345", hash)).resolves.toBe(true);

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          userId: "admin-1",
          action: "UPDATE",
          entityType: "User",
          entityId: "user-1",
          metadata: { passwordChange: true, initiatedBy: "admin" },
        }),
      );
    });
  });

  describe("changeOwnPassword", () => {
    it("rejeita quando o usuário não existe", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.changeOwnPassword(makeUser(), "atual", "Demo@12345")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejeita usuário SSO-only (sem passwordHash)", async () => {
      repo.findById.mockResolvedValue({ ...USER_ADMIN_RAW, passwordHash: null });
      await expect(service.changeOwnPassword(makeUser(), "atual", "Demo@12345")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejeita senha atual incorreta", async () => {
      const hash = await bcrypt.hash("senha-correta", 4);
      repo.findById.mockResolvedValue({ ...USER_ADMIN_RAW, passwordHash: hash });
      await expect(
        service.changeOwnPassword(makeUser(), "senha-errada", "Demo@12345"),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.setPasswordHash).not.toHaveBeenCalled();
    });

    it("com senha atual correta e nova senha válida, atualiza e grava auditoria com initiatedBy self", async () => {
      const hash = await bcrypt.hash("senha-correta", 4);
      repo.findById.mockResolvedValue({ ...USER_ADMIN_RAW, passwordHash: hash });

      await service.changeOwnPassword(makeUser(), "senha-correta", "Nova@Senha1");

      expect(repo.setPasswordHash).toHaveBeenCalledWith("user-1", expect.any(String));
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          action: "UPDATE",
          entityType: "User",
          entityId: "user-1",
          metadata: { passwordChange: true, initiatedBy: "self" },
        }),
      );
    });
  });
});
