import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import type { Request } from "express";
import { AuthService } from "../auth.service";
import type { UserWithPermissions } from "../../users/users.repository";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: "email", passwordField: "password", passReqToCallback: true });
  }

  async validate(req: Request, email: string, password: string): Promise<UserWithPermissions> {
    const tenantSlug = (req.body as Record<string, unknown> | undefined)?.tenantSlug;
    if (typeof tenantSlug !== "string" || tenantSlug.length === 0) {
      throw new UnauthorizedException("tenantSlug é obrigatório.");
    }

    const tenantId = await this.authService.resolveTenantIdBySlug(tenantSlug);
    return this.authService.validateLocalUser(tenantId, email, password);
  }
}
