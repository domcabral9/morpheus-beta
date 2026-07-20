/**
 * Formato de `request.user` depois do JwtAuthGuard. As permissões vêm
 * embutidas no próprio token (calculadas no login/refresh) — evita uma
 * consulta ao banco a cada requisição autenticada. Trade-off aceito: mudanças
 * de papel/permissão só valem a partir do próximo login ou refresh, não
 * instantaneamente.
 */
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  permissions: string[];
}
