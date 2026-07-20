import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { UserWithPermissions } from "../users/users.repository";

const CONFIG_VALUES: Record<string, string> = {
  JWT_ACCESS_SECRET: "test-access-secret-0123456789",
  JWT_ACCESS_EXPIRES_IN: "15m",
  JWT_REFRESH_SECRET: "test-refresh-secret-0123456789",
  JWT_REFRESH_EXPIRES_IN: "7d",
};

const baseUser: UserWithPermissions = {
  id: "user-1",
  tenantId: "tenant-1",
  name: "Ana Exemplo",
  email: "ana@example.com",
  passwordHash: null,
  ssoSubject: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  permissionKeys: ["assessments:create"],
};

describe("AuthService", () => {
  let authService: AuthService;
  let usersService: { findByEmail: jest.Mock; findById: jest.Mock; touchLastLogin: jest.Mock };
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      touchLastLogin: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: "rt-1" }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: ConfigService, useValue: { getOrThrow: (key: string) => CONFIG_VALUES[key] } },
        { provide: UsersService, useValue: usersService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe("validateLocalUser", () => {
    it("rejeita quando o usuário não existe", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        authService.validateLocalUser("tenant-1", "ana@example.com", "senha"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejeita quando o usuário não tem senha local (só SSO)", async () => {
      usersService.findByEmail.mockResolvedValue({ ...baseUser, passwordHash: null });
      await expect(
        authService.validateLocalUser("tenant-1", "ana@example.com", "senha"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejeita senha incorreta", async () => {
      const hash = await bcrypt.hash("senha-correta", 4);
      usersService.findByEmail.mockResolvedValue({ ...baseUser, passwordHash: hash });
      await expect(
        authService.validateLocalUser("tenant-1", "ana@example.com", "senha-errada"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("aceita senha correta e devolve o usuário", async () => {
      const hash = await bcrypt.hash("senha-correta", 4);
      usersService.findByEmail.mockResolvedValue({ ...baseUser, passwordHash: hash });
      const result = await authService.validateLocalUser(
        "tenant-1",
        "ana@example.com",
        "senha-correta",
      );
      expect(result.id).toBe("user-1");
    });
  });

  describe("login", () => {
    it("emite access e refresh token e persiste o hash do refresh", async () => {
      const tokens = await authService.login(baseUser, {});
      expect(tokens.accessToken).toEqual(expect.any(String));
      expect(tokens.refreshToken).toEqual(expect.any(String));
      expect(usersService.touchLastLogin).toHaveBeenCalledWith("user-1");
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArgs.data.userId).toBe("user-1");
      expect(createArgs.data.tokenHash).not.toBe(tokens.refreshToken);
    });
  });

  describe("refresh", () => {
    it("rotaciona: revoga o token antigo e emite um novo na mesma família", async () => {
      const { refreshToken } = await authService.login(baseUser, {});
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        familyId: "family-1",
        revokedAt: null,
      });
      usersService.findById.mockResolvedValue(baseUser);

      const rotated = await authService.refresh(refreshToken, {});

      expect(rotated.accessToken).toEqual(expect.any(String));
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "rt-1" } }),
      );
    });

    it("detecta reuso (token já revogado) e revoga a família inteira", async () => {
      const { refreshToken } = await authService.login(baseUser, {});
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        familyId: "family-1",
        revokedAt: new Date(),
      });

      await expect(authService.refresh(refreshToken, {})).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: "family-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("rejeita token não reconhecido", async () => {
      const { refreshToken } = await authService.login(baseUser, {});
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(authService.refresh(refreshToken, {})).rejects.toThrow(UnauthorizedException);
    });

    it("rejeita um token assinado com segredo diferente (adulterado)", async () => {
      const forgedJwt = new JwtService();
      const forged = forgedJwt.sign({ sub: "user-1", familyId: "x" }, { secret: "outro-segredo" });
      await expect(authService.refresh(forged, {})).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("revoga o refresh token informado", async () => {
      const { refreshToken } = await authService.login(baseUser, {});
      await authService.logout(refreshToken);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
      );
    });
  });
});
