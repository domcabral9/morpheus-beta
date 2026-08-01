export interface OwnProfile {
  id: string;
  name: string;
  email: string;
  hasAvatar: boolean;
  hasLocalPassword: boolean;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}
