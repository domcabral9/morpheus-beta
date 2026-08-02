import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Patch,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../../common/constants/permissions";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { CsrfGuard, CSRF_COOKIE_NAME } from "../../common/guards/csrf.guard";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { SamlAuthGuard } from "./guards/saml-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { SwitchTenantDto } from "./dto/switch-tenant.dto";
import { AccessTokenResponseDto } from "./dto/access-token-response.dto";
import type { UserWithPermissions } from "../users/users.repository";
import { UsersService } from "../users/users.service";
import { ChangeOwnPasswordDto } from "../users/dto/change-own-password.dto";
import { UpdateOwnProfileDto } from "../users/dto/update-own-profile.dto";
import { TwoFactorService } from "../two-factor/two-factor.service";
import { EnableTwoFactorDto } from "../two-factor/dto/enable-two-factor.dto";
import { TwoFactorReauthDto } from "../two-factor/dto/two-factor-reauth.dto";

const REFRESH_COOKIE_NAME = "morpheus_refresh_token";
const REFRESH_COOKIE_PATH = "/auth";
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — mesmo limite do logo do tenant
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Public()
  // Alvo clássico de força bruta — bem mais estrito que o limite global.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login local (email/senha) — requer tenantSlug." })
  @ApiBody({ type: LoginDto })
  async login(
    @Req() req: Request & { user: UserWithPermissions },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponseDto> {
    const tokens = await this.authService.login(req.user, this.requestMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    this.setCsrfCookie(res);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  // Chamado automaticamente a cada carregamento de página (refresh
  // silencioso) — mais folgado que login, mas ainda bem abaixo do limite
  // global para não virar um vetor de força bruta contra o cookie.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(CsrfGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rotaciona o refresh token (cookie httpOnly) e emite um novo access token.",
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponseDto> {
    const raw = this.readRefreshCookie(req);
    if (!raw) {
      throw new UnauthorizedException("Refresh token ausente.");
    }
    const tokens = await this.authService.refresh(raw, this.requestMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    this.setCsrfCookie(res);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoga o refresh token atual." })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw = this.readRefreshCookie(req);
    if (raw) {
      await this.authService.logout(raw);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
  }

  @Get("me")
  @ApiOperation({ summary: "Dados do usuário autenticado (a partir do access token)." })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  // Autenticado via Bearer normal (sem @RequirePermissions: qualquer usuário
  // gerencia a própria senha) — mesmo limite de força bruta do login, já que
  // errar `currentPassword` repetidamente é a mesma classe de risco.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Patch("password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Troca a própria senha (requer a senha atual)." })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeOwnPasswordDto,
  ): Promise<void> {
    await this.usersService.changeOwnPassword(user, dto.currentPassword, dto.newPassword);
  }

  // Sem @RequirePermissions (qualquer autenticado age só sobre si mesmo, via
  // @CurrentUser() - nenhuma das 4 rotas abaixo aceita id de terceiro por
  // path/query/body) e sem @Throttle dedicado (não é alvo de força bruta como
  // senha/login - mesmo tratamento de POST/GET /tenants/current/logo, que
  // segue o mesmo padrão de upload sendo espelhado aqui).
  @Get("profile")
  @ApiOperation({
    summary: "Perfil completo do usuário autenticado (lido do banco, não do token).",
  })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getOwnProfile(user);
  }

  @Patch("profile")
  @ApiOperation({ summary: "Atualiza o próprio nome (email não é editável aqui)." })
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOwnProfileDto) {
    return this.usersService.updateOwnProfile(user, dto.name);
  }

  @Post("avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(null, ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype));
      },
    }),
  )
  @ApiOperation({ summary: "Envia/substitui a própria foto de perfil." })
  uploadAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        "Nenhum arquivo enviado, ou o tipo/tamanho do arquivo não é permitido (só PNG/JPEG até 2MB).",
      );
    }
    return this.usersService.uploadOwnAvatar(user, file);
  }

  @Get("avatar")
  @ApiOperation({ summary: "Foto de perfil do usuário autenticado." })
  async getAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const { buffer, contentType } = await this.usersService.getOwnAvatar(user);
    res.set({
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "Content-Length": String(buffer.length),
    });
    res.send(buffer);
  }

  // 4 rotas de 2FA (autoatendimento) - mesmo padrão de /auth/profile e
  // /auth/avatar: Bearer normal, sem @RequirePermissions (age só sobre
  // @CurrentUser()), @Throttle nas que aceitam um código adivinhável (mesmo
  // limite de /auth/password e do login).
  @Post("2fa/setup")
  @ApiOperation({ summary: "Inicia o enrollment de 2FA: gera secret + QR code (ainda não ativa)." })
  beginTwoFactorSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.beginSetup(user);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("2fa/enable")
  @ApiOperation({ summary: "Confirma o enrollment com um código válido e ativa o 2FA." })
  enableTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnableTwoFactorDto) {
    return this.twoFactorService.confirmSetup(user, dto.code);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Patch("2fa/disable")
  @ApiOperation({ summary: "Desativa o 2FA (requer a senha atual)." })
  async disableTwoFactor(@CurrentUser() user: AuthenticatedUser, @Body() dto: TwoFactorReauthDto) {
    await this.twoFactorService.disable(user, dto.currentPassword);
    return this.usersService.getOwnProfile(user);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("2fa/backup-codes/regenerate")
  @ApiOperation({ summary: "Gera um novo lote de códigos de backup (requer a senha atual)." })
  regenerateTwoFactorBackupCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorReauthDto,
  ) {
    return this.twoFactorService.regenerateBackupCodes(user, dto.currentPassword);
  }

  // Autenticado via Bearer normal (JwtAuthGuard + PermissionsGuard, ambos
  // globais) — diferente de refresh/logout, não é o padrão cookie-only, então
  // não precisa de CsrfGuard. Não toca o refresh token/cookie: só reemite o
  // access token com `tenantId` trocado (ver AuthService.switchTenant).
  @RequirePermissions(PERMISSIONS.PLATFORM_CROSS_TENANT)
  @Post("switch-tenant")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Super-admin: reemite o access token visualizando outro tenant (ou volta pro de casa).",
  })
  async switchTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SwitchTenantDto,
    @Req() req: Request,
  ): Promise<AccessTokenResponseDto> {
    return this.authService.switchTenant(user, dto.tenantId, this.requestMeta(req));
  }

  @Public()
  @UseGuards(SamlAuthGuard)
  @Get("saml/login")
  @ApiOperation({ summary: "Inicia o login SSO — redireciona para o Identity Provider." })
  samlLogin(): void {
    // O guard já redireciona para o entryPoint do IdP; nada a fazer aqui.
  }

  @Public()
  @UseGuards(SamlAuthGuard)
  @Post("saml/callback")
  @ApiOperation({ summary: "Callback do Identity Provider (SAMLResponse via POST)." })
  async samlCallback(
    @Req() req: Request & { user: UserWithPermissions },
    @Res() res: Response,
  ): Promise<void> {
    const tokens = await this.authService.login(req.user, this.requestMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    this.setCsrfCookie(res);

    // O IdP faz um POST direto do browser para cá (não é uma chamada XHR do
    // frontend) — não há como devolver o access token no corpo da resposta
    // para o app React ler. Redireciona para uma página da Web que chama
    // POST /auth/refresh (o cookie httpOnly já foi setado acima) para obter
    // o primeiro access token pelo mesmo caminho de qualquer refresh normal.
    const webOrigin = this.configService.get<string>("CORS_ORIGIN", "http://localhost:3000");
    res.redirect(`${webOrigin}/auth/sso-callback`);
  }

  private requestMeta(req: Request): { userAgent?: string; ipAddress?: string } {
    return {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    };
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE_NAME];
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
      maxAge: this.parseExpiresInMs(
        this.configService.getOrThrow<string>("JWT_REFRESH_EXPIRES_IN"),
      ),
    });
  }

  /**
   * Não-httpOnly de propósito — o frontend precisa ler o valor via
   * document.cookie para reenviá-lo no header X-CSRF-Token (double-submit
   * cookie, ver CsrfGuard). path "/" (não "/auth"): a página que lê o
   * cookie via JS pode estar em qualquer rota da Web, e Path restringe
   * document.cookie pelo path do documento atual, não só pelo path de quem
   * setou o cookie.
   */
  private setCsrfCookie(res: Response): void {
    res.cookie(CSRF_COOKIE_NAME, randomBytes(32).toString("hex"), {
      httpOnly: false,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/",
      maxAge: this.parseExpiresInMs(
        this.configService.getOrThrow<string>("JWT_REFRESH_EXPIRES_IN"),
      ),
    });
  }

  private parseExpiresInMs(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      match[2] as "s" | "m" | "h" | "d"
    ];
    return value * unitMs;
  }
}
