"use client";

import { useAuth } from "@/components/auth-provider";
import { ADMIN_NAV_ITEMS } from "@/lib/nav-items";

/** `usePermission("workflow:approve")` -> true se a sessão atual tiver essa permissão. */
export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions.includes(permission) ?? false;
}

/** True se o usuário tiver qualquer permissão que libere uma seção de `/admin`. */
export function useHasAnyManagePermission(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return ADMIN_NAV_ITEMS.some((item) => user.permissions.includes(item.permission));
}
