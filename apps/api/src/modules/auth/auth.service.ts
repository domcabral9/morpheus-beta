import { createHash, randomUUID } from "node:crypto";
import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { CryptoService } from "../../common/services/crypto/crypto.service";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AuditLogService } from "../audit/audit-log.service";
import { UsersService } from "../users/users.service";
import type { UserWithPermissions } from "../users/users.repository";
import type { AccessTokenPayload, RefreshTokenPayload } from "./interfaces/jwt-payload.interface";

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly cryptoService: CryptoService,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>("JWT_ACCESS_SECRET");
    this.accessExpiresIn = this.configService.getOrThrow<string>("JWT_ACCESS_EXPIRES_IN");
    this.refreshSecret = this.configService.getOrThrow<string>("JWT_REFRESH_SECRET");
    this.refreshExpiresIn = this.configService.getOrThrow<string>("JWT_REFRESH_EXPIRES_IN");
  }

  /**
   * Resolve o slug informado no login (ex.: "demo") para o tenantId real.
   * Placeholder honesto até existir seleção de tenant de verdade na Web
   * (subdomínio ou tela de escolha) — não esconde a multi-tenancy atrás de
   * um tenant default fixo no código.
   */
  async resolveTenantIdBySlug(slug: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      throw new UnauthorizedException("Organização não encontrada.");
    }
    return tenant.id;
  }

  /** Usado pela LocalStrategy. */
  async validateLocalUser(
    tenantId: string,
    email: string,
    password: string,
  ): Promise<UserWithPermissions> {
    const user = await this.usersService.findByEmail(tenantId, email);
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    return user;
  }

  async login(user: UserWithPermissions, meta: RequestMeta): Promise<TokenPair> {
    await this.usersService.touchLastLogin(user.id);
    const tokens = await this.issueTokenPair(user, randomUUID(), meta);

    await this.auditLogService.record({
      tenantId: user.tenantId,
      userId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return tokens;
  }

  async refresh(rawToken: string, meta: RequestMeta): Promise<TokenPair> {
    const payload = this.verifyRefreshToken(rawToken);
    const tokenHash = hashToken(rawToken);

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) {
      throw new UnauthorizedException("Refresh token não reconhecido.");
    }

    if (stored.revokedAt) {
      // Um token já rotacionado voltou a ser apresentado: sinal de reuso
      // (roubo/replay). Reação: derruba a família inteira, não só este token.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Reutilização de refresh token detectada; sessão revogada.");
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Usuário inválido ou inativo.");
    }

    const newPair = await this.issueTokenPair(user, stored.familyId, meta);
    const newTokenHash = hashToken(newPair.refreshToken);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: newTokenHash },
    });

    return newPair;
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { userId: true, user: { select: { tenantId: true } } },
    });

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (token) {
      await this.auditLogService.record({
        tenantId: token.user.tenantId,
        userId: token.userId,
        action: "LOGOUT",
        entityType: "User",
        entityId: token.userId,
      });
    }
  }

  /**
   * Reemite o access token com `tenantId` trocado, sem tocar o refresh
   * token/cookie (esses continuam ligados à identidade de casa do ator —
   * ver decisão de design no plano). `sub` nunca muda: a trilha de auditoria
   * das ações feitas "como" outro tenant continua atribuindo ao super-admin
   * real, não a uma identidade sintética.
   */
  async switchTenant(
    actor: AuthenticatedUser,
    targetTenantId: string,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: targetTenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    let accessPayload: AccessTokenPayload;
    if (targetTenantId === actor.homeTenantId) {
      // Volta pro tenant de casa: permissões reais (derivadas do banco),
      // nunca o catálogo inflado usado durante a sessão trocada.
      const user = await this.usersService.findById(actor.id);
      if (!user) {
        throw new UnauthorizedException("Usuário inválido.");
      }
      accessPayload = this.buildAccessPayload(user);
    } else {
      // Sessão trocada: o ator não é sócio real do tenant alvo (sem User row
      // lá) — carrega o catálogo completo de permissões, equivalente a agir
      // como administrador de qualquer tenant para todos os efeitos práticos.
      const allPermissions = await this.prisma.permission.findMany({ select: { key: true } });
      accessPayload = {
        sub: actor.id,
        tenantId: targetTenantId,
        homeTenantId: actor.homeTenantId,
        email: actor.email,
        name: actor.name,
        permissions: allPermissions.map((permission) => permission.key),
        isSuperAdmin: true,
      };
    }

    const accessToken = this.signAccessToken(accessPayload);

    await this.auditLogService.record({
      tenantId: targetTenantId,
      userId: actor.id,
      action: "SWITCH_TENANT",
      entityType: "Tenant",
      entityId: targetTenantId,
      metadata: { homeTenantId: actor.homeTenantId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken, expiresIn: this.accessExpiresIn };
  }

  private verifyRefreshToken(rawToken: string): RefreshTokenPayload {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(rawToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException("Refresh token inválido ou expirado.");
    }
  }

  private buildAccessPayload(user: UserWithPermissions): AccessTokenPayload {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      homeTenantId: user.tenantId,
      email: user.email,
      name: user.name,
      permissions: user.permissionKeys,
      isSuperAdmin: user.permissionKeys.includes(PERMISSIONS.PLATFORM_CROSS_TENANT),
    };
  }

  private signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.accessSecret,
      // `expiresIn` do jsonwebtoken é tipado como um template literal de
      // durações (ex.: "15m"); nossa config vem de env var (string simples,
      // validada em runtime pelo zod) — o cast documenta essa fronteira.
      expiresIn: this.accessExpiresIn as JwtSignOptions["expiresIn"],
    });
  }

  private async issueTokenPair(
    user: UserWithPermissions,
    familyId: string,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const accessToken = this.signAccessToken(this.buildAccessPayload(user));

    const refreshPayload: RefreshTokenPayload = { sub: user.id, familyId };
    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn as JwtSignOptions["expiresIn"],
      jwtid: jti,
    });

    const decoded = this.jwtService.decode<{ exp: number }>(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt: new Date(decoded.exp * 1000),
        userAgent: meta.userAgent,
        // Criptografado em repouso (Etapa 14) — diferente de AuditLog.ipAddress
        // (trilha de auditoria imutável, precisa ficar legível para
        // investigação/compliance), este é dado operacional de sessão sem
        // motivo para ficar em texto plano só de leitura direta no banco.
        ipAddress: meta.ipAddress ? this.cryptoService.encrypt(meta.ipAddress) : undefined,
      },
    });

    return { accessToken, refreshToken, expiresIn: this.accessExpiresIn };
  }
}
