export interface TenantAdmin {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  securityTeamName: string | null;
  opinionNumberPrefix: string;
  annualClosingWindowStart: string | null;
  annualClosingWindowEnd: string | null;
  annualClosingWindowEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
