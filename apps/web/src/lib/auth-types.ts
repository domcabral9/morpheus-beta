export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  /** Tenant real do usuário - igual a `tenantId`, exceto numa sessão trocada
   * via /auth/switch-tenant (super-admin visualizando outro tenant). */
  homeTenantId: string;
  email: string;
  name: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface AccessTokenResponse {
  twoFactorRequired?: false;
  accessToken: string;
  expiresIn: string;
}

/** Resposta de POST /auth/login quando o usuário tem 2FA habilitado - nenhuma
 * sessão foi aberta ainda (sem cookies); `preAuthToken` alimenta
 * POST /auth/2fa/verify-login. */
export interface TwoFactorChallengeResponse {
  twoFactorRequired: true;
  preAuthToken: string;
  expiresIn: string;
}

export type LoginResult = AccessTokenResponse | TwoFactorChallengeResponse;

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
}

/** Shape enxuto de GET /tenants/public (pré-autenticação) - sem `id` de propósito. */
export interface TenantPublicSummary {
  name: string;
  slug: string;
}
