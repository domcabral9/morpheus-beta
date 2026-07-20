export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  email: string;
  name: string;
  permissions: string[];
}

export interface RefreshTokenPayload {
  sub: string;
  familyId: string;
}
