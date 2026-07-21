"use client";

import { useAuth } from "@/components/auth-provider";

/** Permissões que dão acesso a pelo menos uma seção de `/admin` — espelha
 * ADMIN_NAV_ITEMS em admin-shell.tsx. Usado só para decidir se o link
 * "Administração" aparece no header (cada sub-seção ainda se auto-protege). */
const ADMIN_SECTION_PERMISSIONS = [
  "questions:manage",
  "risk-matrix:manage",
  "workflows:manage",
  "audit:view",
  "users:manage",
  "system:configure",
] as const;

/** `usePermission("workflow:approve")` -> true se a sessão atual tiver essa permissão. */
export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions.includes(permission) ?? false;
}

/** True se o usuário tiver qualquer permissão que libere uma seção de `/admin`. */
export function useHasAnyManagePermission(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return ADMIN_SECTION_PERMISSIONS.some((permission) => user.permissions.includes(permission));
}
