import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/interfaces/authenticated-user.interface";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { SamlAuthGuard } from "./guards/saml-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { AccessTokenResponseDto } from "./dto/access-token-response.dto";
import type { UserWithPermissions } from "../users/users.repository";

const REFRESH_COOKIE_NAME = "morpheus_refresh_token";
const REFRESH_COOKIE_PATH = "/auth";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
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
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
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
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoga o refresh token atual." })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw = this.readRefreshCookie(req);
    if (raw) {
      await this.authService.logout(raw);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Get("me")
  @ApiOperation({ summary: "Dados do usuário autenticado (a partir do access token)." })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
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
