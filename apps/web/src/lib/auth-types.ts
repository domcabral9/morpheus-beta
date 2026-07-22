export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  /** Tenant real do usuário — igual a `tenantId`, exceto numa sessão trocada
   * via /auth/switch-tenant (super-admin visualizando outro tenant). */
  homeTenantId: string;
  email: string;
  name: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface AccessTokenResponse {
  accessToken: string;
  expiresIn: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
}
