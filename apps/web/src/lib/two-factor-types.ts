export interface TwoFactorSetup {
  secretBase32: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
}

export interface TwoFactorEnrollmentResult {
  backupCodes: string[];
}
