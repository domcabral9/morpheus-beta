import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "requiredPermissions";

/**
 * Declara quais permission keys (ver seed de Permission) uma rota exige.
 * Checado pelo PermissionsGuard contra `request.user.permissions`.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
