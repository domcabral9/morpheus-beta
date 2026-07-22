export interface PermissionSummary {
  key: string;
  description: string;
}

export interface RoleAdmin {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
}

export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionSummary[];
  userCount: number;
}
