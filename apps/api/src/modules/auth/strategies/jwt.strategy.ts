import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AccessTokenPayload } from "../interfaces/jwt-payload.interface";
import type { AuthenticatedUser } from "../../../common/interfaces/authenticated-user.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  // O token já carrega tudo que a aplicação precisa por requisição (ver
  // AuthService.issueTokenPair) — validate() só remodela o payload assinado
  // para o formato usado pelos controllers, sem tocar o banco.
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      name: payload.name,
      permissions: payload.permissions,
    };
  }
}
