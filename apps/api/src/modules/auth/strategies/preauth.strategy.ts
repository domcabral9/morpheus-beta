import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { PreAuthTokenPayload } from "../interfaces/jwt-payload.interface";
import type { PendingTwoFactorUser } from "../../../common/interfaces/pending-two-factor-user.interface";

/**
 * Verifica o token de escopo limitado emitido entre "senha correta" e
 * "código 2FA validado" - secret próprio (JWT_PREAUTH_SECRET), nunca o mesmo
 * de JwtStrategy (access token normal). Mesmo mecanismo de duas estratégias
 * Passport paralelas já usado para access/refresh, com um terceiro par.
 */
@Injectable()
export class PreAuthStrategy extends PassportStrategy(Strategy, "jwt-preauth") {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_PREAUTH_SECRET"),
    });
  }

  validate(payload: PreAuthTokenPayload): PendingTwoFactorUser {
    return { id: payload.sub, tenantId: payload.tenantId };
  }
}
