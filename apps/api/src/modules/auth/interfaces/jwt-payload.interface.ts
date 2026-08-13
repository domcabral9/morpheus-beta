export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  /** Tenant real do usuário - igual a `tenantId`, exceto numa sessão trocada
   * via /auth/switch-tenant (super-admin visualizando outro tenant). */
  homeTenantId: string;
  email: string;
  name: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface RefreshTokenPayload {
  sub: string;
  familyId: string;
}

/**
 * Token de escopo limitado emitido entre "senha correta" e "código 2FA
 * validado" (ver AuthService.issuePreAuthChallenge / PreAuthGuard). Secret
 * próprio (JWT_PREAUTH_SECRET, nunca o de access/refresh), vida curta, sem
 * `permissions`/`isSuperAdmin` - nunca serve como Bearer normal.
 */
export interface PreAuthTokenPayload {
  sub: string;
  tenantId: string;
  typ: "2fa_pending";
}
