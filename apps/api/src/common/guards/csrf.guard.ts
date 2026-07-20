import { timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

export const CSRF_COOKIE_NAME = "morpheus_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Double-submit cookie: exige que o valor do cookie (não-httpOnly, o
 * frontend lê via document.cookie) bata com um header enviado explicitamente
 * pelo JS. Um request forjado cross-site consegue fazer o browser mandar o
 * cookie sozinho, mas não consegue ler seu valor para replicar no header —
 * `sameSite: "strict"` no cookie de refresh já bloqueia isso na prática,
 * este guard é defesa em profundidade sobre os dois endpoints que mutam
 * estado autenticados só por cookie (refresh, logout).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    if (
      !cookieToken ||
      typeof headerToken !== "string" ||
      !this.tokensMatch(cookieToken, headerToken)
    ) {
      throw new ForbiddenException("Token CSRF ausente ou inválido.");
    }
    return true;
  }

  private tokensMatch(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
