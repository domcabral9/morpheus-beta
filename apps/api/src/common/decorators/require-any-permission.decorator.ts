import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_ANY_KEY = "requiredPermissionsAny";

/**
 * Variante "OU" de `@RequirePermissions()`: a rota libera se o usuário tiver
 * QUALQUER uma das permissões listadas (RequirePermissions exige todas —
 * ver `PermissionsGuard`). Usar quando a mesma leitura serve a mais de uma
 * tela administrativa com permissões diferentes (ex.: `GET /roles`, usado
 * pelo editor de etapas de workflow e pela atribuição de papéis a usuários).
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
