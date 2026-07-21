export interface TenantAdmin {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  securityTeamName: string | null;
  opinionNumberPrefix: string;
  createdAt: string;
  updatedAt: string;
}
