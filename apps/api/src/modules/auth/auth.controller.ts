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
import { CurrentPreAuthUser } from "../../common/decorators/current-preauth-user.decorator";
import type { PendingTwoFactorUser } from "../../common/interfaces/pending-two-factor-user.interface";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { PreAuthGuard } from "./guards/preauth.guard";
import { SamlAuthGuard } from "./guards/saml-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { SwitchTenantDto } from "./dto/switch-tenant.dto";
import { AccessTokenResponseDto } from "./dto/access-token-response.dto";
import { TwoFactorChallengeResponseDto } from "./dto/two-factor-challenge-response.dto";
import { VerifyTwoFactorLoginDto } from "./dto/verify-two-factor-login.dto";
import type { UserWithPermissions } from "../users/users.repository";
import { UsersService } from "../users/users.service";
import { ChangeOwnPasswordDto } from "../users/dto/change-own-password.dto";
import { UpdateOwnProfileDto } from "../users/dto/update-own-profile.dto";
import { TwoFactorService } from "../two-factor/two-factor.service";
import { EnableTwoFactorDto } from "../two-factor/dto/enable-two-factor.dto";
import { TwoFactorReauthDto } from "../two-factor/dto/two-factor-reauth.dto";
import { EmailVerificationService } from "./email-verification.service";
import { ConfirmEmailVerificationDto } from "./dto/confirm-email-verification.dto";
import { PasswordlessService } from "./passwordless.service";
import { RequestPasswordlessLoginDto } from "./dto/request-passwordless-login.dto";
import { VerifyPasswordlessLoginDto } from "./dto/verify-passwordless-login.dto";

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
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordlessService: PasswordlessService,
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
  ): Promise<AccessTokenResponseDto | TwoFactorChallengeResponseDto> {
    if (req.user.totpEnabled) {
      // Senha correta, mas 2FA pendente - nenhuma sessão é aberta ainda
      // (sem cookies), o login só completa de fato em /auth/2fa/verify-login.
      const challenge = this.authService.issuePreAuthChallenge(req.user);
      return { twoFactorRequired: true, ...challenge };
    }

    const tokens = await this.authService.login(req.user, this.requestMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    this.setCsrfCookie(res);
    return {
      twoFactorRequired: false,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  @Public()
  // Segundo passo do login quando totpEnabled - guardado pelo pre-auth token
  // de vida curta (nunca o access token normal, secret diferente), não pelo
  // JwtAuthGuard global. Mesmo limite de força bruta do login/senha.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(PreAuthGuard)
  @Post("2fa/verify-login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Segundo passo do login: valida o código 2FA e emite a sessão." })
  async verifyTwoFactorLogin(
    @CurrentPreAuthUser() pending: PendingTwoFactorUser,
    @Body() dto: VerifyTwoFactorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponseDto> {
    const user = await this.usersService.findById(pending.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Usuário inválido ou inativo.");
    }

    await this.twoFactorService.verifyLoginCode(user, dto.code);

    const tokens = await this.authService.login(user, this.requestMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    this.setCsrfCookie(res);
    return {
      twoFactorRequired: false,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
  }

  // Login passwordless (Fase 3) — fator primário alternativo ao par
  // e-mail/senha, sem prompt de senha. Sempre responde no formato exato do
  // caso de sucesso, mesmo quando tenant/e-mail não existe, usuário está
  // inativo, e-mail não verificado ou o toggle de plataforma está desligado
  // - PasswordlessService.requestLogin nunca lança, contrato deliberado de
  // anti-enumeração (ver plano/CHANGELOG). Mesmo throttle de força bruta do
  // login.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("passwordless/request")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Envia um código de login para o e-mail, se a conta for elegível." })
  async requestPasswordlessLogin(
    @Body() dto: RequestPasswordlessLoginDto,
  ): Promise<{ sent: true }> {
    await this.passwordlessService.requestLogin(dto.tenantSlug, dto.email);
    return { sent: true };
  }

  // Verificado o código, abre a sessão diretamente via authService.login() -
  // pula por completo o branch de totpEnabled/issuePreAuthChallenge que o
  // login por senha percorre (decisão explícita do usuário: posse do e-mail
  // substitui os dois fatores tradicionais neste caminho específico, ver
  // plano/CHANGELOG - marcado para escrutínio extra na Fase 6 de segurança).
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("passwordless/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirma o código de login passwordless e emite a sessão." })
  async verifyPasswordlessLogin(
    @Body() dto: VerifyPasswordlessLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenResponseDto> {
    const user = await this.passwordlessService.verifyLogin(dto.tenantSlug, dto.email, dto.code);

    const tokens = await this.authService.login(user, this.requestMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    this.setCsrfCookie(res);
    return {
      twoFactorRequired: false,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    };
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

  // Verificação de e-mail (autoatendimento, pré-requisito de login
  // passwordless — Fase 3) — mesmo padrão de /auth/2fa/*: Bearer normal, sem
  // @RequirePermissions (age só sobre @CurrentUser()), mesmo limite de força
  // bruta de um código adivinhável.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("email/verify/request")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Envia um código de verificação para o próprio e-mail." })
  async requestEmailVerification(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.emailVerificationService.requestVerification(user);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("email/verify/confirm")
  @ApiOperation({ summary: "Confirma o código e marca o e-mail como verificado." })
  async confirmEmailVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmEmailVerificationDto,
  ) {
    await this.emailVerificationService.confirmVerification(user, dto.code);
    return this.usersService.getOwnProfile(user);
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

  // Achado da revisão de segurança da Fase 7 do 2FA (ver CHANGELOG): a
  // suposição original aqui ("SSO-only nunca tem totpEnabled=true") estava
  // errada — `findOrProvisionBySso` casa por e-mail quando não há
  // `ssoSubject` prévio, então uma conta com senha local + 2FA habilitado é
  // resolvida normalmente por aqui, e o login completaria sem pedir o
  // segundo fator. Bloqueado explicitamente: contas com 2FA habilitado não
  // completam login via SSO (precisam usar login local + código). Fechar
  // esse bypass sem construir um fluxo de continuação de 2FA para SSO (fora
  // de escopo desta fase) é a correção mínima e suficiente.
  @Public()
  @UseGuards(SamlAuthGuard)
  @Post("saml/callback")
  @ApiOperation({ summary: "Callback do Identity Provider (SAMLResponse via POST)." })
  async samlCallback(
    @Req() req: Request & { user: UserWithPermissions },
    @Res() res: Response,
  ): Promise<void> {
    const webOrigin = this.configService.get<string>("CORS_ORIGIN", "http://localhost:3000");

    if (req.user.totpEnabled) {
      res.redirect(`${webOrigin}/login?ssoError=totp_required`);
      return;
    }

    const tokens = await this.authService.login(req.user, this.requestMeta(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    this.setCsrfCookie(res);

    // O IdP faz um POST direto do browser para cá (não é uma chamada XHR do
    // frontend) — não há como devolver o access token no corpo da resposta
    // para o app React ler. Redireciona para uma página da Web que chama
    // POST /auth/refresh (o cookie httpOnly já foi setado acima) para obter
    // o primeiro access token pelo mesmo caminho de qualquer refresh normal.
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
