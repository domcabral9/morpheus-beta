export interface RoleSummary {
  id: string;
  name: string;
}

export interface UserRoleLink {
  role: RoleSummary;
}

export interface UserAdmin {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  userRoles: UserRoleLink[];
}
