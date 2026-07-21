/** Shape mínima de `GET /users` usada só para popular seletores (inventário,
 * filtro de auditoria) — não o detalhe administrativo completo de
 * `users-admin-types.ts` (que inclui papéis, usado só em `/admin/users`). */
export interface UserOption {
  id: string;
  name: string;
  email: string;
}
