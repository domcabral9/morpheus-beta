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

export interface PlatformTwoFactorPolicy {
  id: string;
  enforced: boolean;
  updatedByUserId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface PlatformPasswordlessPolicy {
  id: string;
  enabled: boolean;
  updatedByUserId: string | null;
  updatedAt: string;
  createdAt: string;
}

/** Forma mascarada - nunca inclui a chave do VirusTotal, cru ou decriptografado. */
export interface PlatformIntegrationsPolicy {
  virusTotalEnabled: boolean;
  virusTotalDailyBudget: number;
  hasVirusTotalApiKey: boolean;
  endoflifeEnabled: boolean;
  updatedByUserId: string | null;
  updatedAt: string;
}
