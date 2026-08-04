export interface OwnProfile {
  id: string;
  name: string;
  email: string;
  hasAvatar: boolean;
  hasLocalPassword: boolean;
  hasTwoFactorEnabled: boolean;
  twoFactorEnforced: boolean;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}
