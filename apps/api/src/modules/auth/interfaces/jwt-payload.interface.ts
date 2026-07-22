export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  /** Tenant real do usuário — igual a `tenantId`, exceto numa sessão trocada
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
