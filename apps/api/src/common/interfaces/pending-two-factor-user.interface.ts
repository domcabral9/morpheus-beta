/**
 * Formato de `request.user` depois do PreAuthGuard — deliberadamente sem
 * `permissions`/`isSuperAdmin` (nunca deve ser confundível com
 * `AuthenticatedUser`, o formato usado por todo o resto da API autenticada).
 */
export interface PendingTwoFactorUser {
  id: string;
  tenantId: string;
}
