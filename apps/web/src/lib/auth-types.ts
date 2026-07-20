export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  permissions: string[];
}

export interface AccessTokenResponse {
  accessToken: string;
  expiresIn: string;
}
