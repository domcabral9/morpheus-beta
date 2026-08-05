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
import { TwoFactorPolicyService } from "../platform-policy/two-factor-policy.service";
import { TwoFactorService } from "../two-factor/two-factor.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditLogService } from "../audit/audit-log.service";
import { STORAGE_ADAPTER } from "../storage/storage.interface";
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
  totpEnabled: false,
  lastLoginAt: null,
  createdAt: new Date(),
  userRoles: [],
};

const OWN_PROFILE_RAW = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
  avatarPath: null as string | null,
  passwordHash: null as string | null,
  totpEnabled: false,
  lastLoginAt: null,
  createdAt: new Date(),
  userRoles: [{ role: { name: "Analista" } }],
};

describe("UsersService", () => {
  let service: UsersService;
  let repo: {
    findByIdRaw: jest.Mock;
    findById: jest.Mock;
    findAvatarPath: jest.Mock;
    setPasswordHash: jest.Mock;
    findOwnProfile: jest.Mock;
    updateName: jest.Mock;
    setAvatarPath: jest.Mock;
  };
  let passwordPolicyService: { validate: jest.Mock };
  let twoFactorPolicyService: { getPolicy: jest.Mock };
  let twoFactorService: { forceDisable: jest.Mock };
  let notificationsService: { sendRawEmail: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let storage: { save: jest.Mock; read: jest.Mock };

  beforeEach(async () => {
    repo = {
      findByIdRaw: jest.fn().mockResolvedValue(USER_ADMIN_RAW),
      findById: jest.fn(),
      findAvatarPath: jest.fn(),
      setPasswordHash: jest.fn().mockResolvedValue(undefined),
      findOwnProfile: jest.fn().mockResolvedValue(OWN_PROFILE_RAW),
      updateName: jest.fn().mockResolvedValue(undefined),
      setAvatarPath: jest.fn().mockResolvedValue(undefined),
    };
    passwordPolicyService = { validate: jest.fn().mockResolvedValue(undefined) };
    twoFactorPolicyService = { getPolicy: jest.fn().mockResolvedValue({ enforced: false }) };
    twoFactorService = { forceDisable: jest.fn().mockResolvedValue(undefined) };
    notificationsService = { sendRawEmail: jest.fn().mockResolvedValue(undefined) };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    storage = { save: jest.fn().mockResolvedValue(undefined), read: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repo },
        { provide: RolesService, useValue: {} },
        { provide: PasswordPolicyService, useValue: passwordPolicyService },
        { provide: TwoFactorPolicyService, useValue: twoFactorPolicyService },
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: STORAGE_ADAPTER, useValue: storage },
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

  describe("forceDisableTwoFactor", () => {
    it("rejeita quando o alvo é o próprio ator, sem tocar o repositório", async () => {
      await expect(service.forceDisableTwoFactor("tenant-1", "user-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(twoFactorService.forceDisable).not.toHaveBeenCalled();
    });

    it("rejeita usuário de outro tenant", async () => {
      repo.findByIdRaw.mockResolvedValue({ ...USER_ADMIN_RAW, tenantId: "tenant-2" });
      await expect(service.forceDisableTwoFactor("tenant-1", "admin-1", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("rejeita quando o alvo não tem 2FA ativo", async () => {
      repo.findByIdRaw.mockResolvedValue({ ...USER_ADMIN_RAW, totpEnabled: false });
      await expect(service.forceDisableTwoFactor("tenant-1", "admin-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(twoFactorService.forceDisable).not.toHaveBeenCalled();
    });

    it("desativa, grava auditoria com initiatedBy admin e notifica o usuário por e-mail", async () => {
      repo.findByIdRaw.mockResolvedValue({ ...USER_ADMIN_RAW, totpEnabled: true });

      await service.forceDisableTwoFactor("tenant-1", "admin-1", "user-1");

      expect(twoFactorService.forceDisable).toHaveBeenCalledWith("user-1");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          userId: "admin-1",
          action: "UPDATE",
          entityType: "User",
          entityId: "user-1",
          metadata: { field: "twoFactor", event: "disabled", initiatedBy: "admin" },
        }),
      );
      expect(notificationsService.sendRawEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "a@b.com" }),
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

  describe("getOwnProfile", () => {
    it("mapeia hasAvatar/hasLocalPassword e nunca vaza o hash cru", async () => {
      repo.findOwnProfile.mockResolvedValue({
        ...OWN_PROFILE_RAW,
        avatarPath: "user-avatars/user-1/avatar.png",
        passwordHash: "$2b$hash",
      });

      const profile = await service.getOwnProfile(makeUser());

      expect(profile).toEqual({
        id: "user-1",
        name: "A",
        email: "a@b.com",
        hasAvatar: true,
        hasLocalPassword: true,
        hasTwoFactorEnabled: false,
        twoFactorEnforced: false,
        roles: ["Analista"],
        lastLoginAt: null,
        createdAt: OWN_PROFILE_RAW.createdAt,
      });
      expect(profile).not.toHaveProperty("passwordHash");
      expect(profile).not.toHaveProperty("avatarPath");
    });

    it("rejeita quando o usuário não existe mais", async () => {
      repo.findOwnProfile.mockResolvedValue(null);
      await expect(service.getOwnProfile(makeUser())).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateOwnProfile", () => {
    it("rejeita nome vazio/só espaço sem tocar o repositório", async () => {
      await expect(service.updateOwnProfile(makeUser(), "   ")).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.updateName).not.toHaveBeenCalled();
    });

    it("atualiza o nome (trimado) e grava auditoria com initiatedBy self", async () => {
      await service.updateOwnProfile(makeUser(), "  Novo Nome  ");

      expect(repo.updateName).toHaveBeenCalledWith("user-1", "Novo Nome");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          action: "UPDATE",
          entityType: "User",
          entityId: "user-1",
          metadata: { field: "name", initiatedBy: "self" },
        }),
      );
    });
  });

  describe("uploadOwnAvatar", () => {
    it("rejeita MIME não suportado sem chamar o storage", async () => {
      const file = { mimetype: "image/gif", buffer: Buffer.from("x") } as Express.Multer.File;
      await expect(service.uploadOwnAvatar(makeUser(), file)).rejects.toThrow(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
      expect(repo.setAvatarPath).not.toHaveBeenCalled();
    });

    it("salva na chave user-avatars/:id/avatar.ext, persiste e audita", async () => {
      const file = { mimetype: "image/png", buffer: Buffer.from("x") } as Express.Multer.File;
      await service.uploadOwnAvatar(makeUser(), file);

      expect(storage.save).toHaveBeenCalledWith("user-avatars/user-1/avatar.png", file.buffer);
      expect(repo.setAvatarPath).toHaveBeenCalledWith("user-1", "user-avatars/user-1/avatar.png");
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { field: "avatar", initiatedBy: "self" },
        }),
      );
    });
  });

  describe("getOwnAvatar", () => {
    it("rejeita quando o usuário nunca enviou avatar", async () => {
      repo.findOwnProfile.mockResolvedValue({ ...OWN_PROFILE_RAW, avatarPath: null });
      await expect(service.getOwnAvatar(makeUser())).rejects.toThrow(NotFoundException);
      expect(storage.read).not.toHaveBeenCalled();
    });

    it("lê do storage e resolve o content-type pela extensão", async () => {
      repo.findOwnProfile.mockResolvedValue({
        ...OWN_PROFILE_RAW,
        avatarPath: "user-avatars/user-1/avatar.jpg",
      });
      storage.read.mockResolvedValue(Buffer.from("imagem"));

      const avatar = await service.getOwnAvatar(makeUser());

      expect(storage.read).toHaveBeenCalledWith("user-avatars/user-1/avatar.jpg");
      expect(avatar).toEqual({ buffer: Buffer.from("imagem"), contentType: "image/jpeg" });
    });
  });

  describe("getAvatarForUser", () => {
    it("rejeita quando o usuário não existe (id inválido ou de outro tenant)", async () => {
      repo.findAvatarPath.mockResolvedValue(null);
      await expect(service.getAvatarForUser("tenant-1", "user-2")).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.read).not.toHaveBeenCalled();
    });

    it("rejeita quando o usuário não tem avatar", async () => {
      repo.findAvatarPath.mockResolvedValue({ avatarPath: null });
      await expect(service.getAvatarForUser("tenant-1", "user-2")).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.read).not.toHaveBeenCalled();
    });

    it("lê do storage e resolve o content-type pela extensão, escopado por tenant", async () => {
      repo.findAvatarPath.mockResolvedValue({ avatarPath: "user-avatars/user-2/avatar.png" });
      storage.read.mockResolvedValue(Buffer.from("imagem"));

      const avatar = await service.getAvatarForUser("tenant-1", "user-2");

      expect(repo.findAvatarPath).toHaveBeenCalledWith("tenant-1", "user-2");
      expect(storage.read).toHaveBeenCalledWith("user-avatars/user-2/avatar.png");
      expect(avatar).toEqual({ buffer: Buffer.from("imagem"), contentType: "image/png" });
    });
  });
});
