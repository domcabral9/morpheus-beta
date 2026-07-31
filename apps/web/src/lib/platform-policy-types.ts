export interface PlatformPasswordPolicy {
  id: string;
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  updatedByUserId: string | null;
  updatedAt: string;
  createdAt: string;
}
