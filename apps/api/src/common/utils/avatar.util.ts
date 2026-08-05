/**
 * Deriva `hasAvatar` a partir do `avatarPath` cru de um ator vindo do banco -
 * nunca expor `avatarPath` (chave de storage interna) direto pro client,
 * mesma disciplina já usada em `UsersService.mapOwnProfile`
 * (`hasAvatar: raw.avatarPath !== null`). Usado em todo endpoint que já
 * retorna `{id, name, email}` de um ator (solicitante, aprovador, quem
 * realizou uma ART, etc.) e precisa expor se essa pessoa tem avatar, sem
 * vazar o caminho de storage.
 */
export function withHasAvatar<T extends { avatarPath: string | null }>(
  actor: T,
): Omit<T, "avatarPath"> & { hasAvatar: boolean } {
  const { avatarPath, ...rest } = actor;
  return { ...rest, hasAvatar: avatarPath !== null };
}

export function withHasAvatarOrNull<T extends { avatarPath: string | null }>(
  actor: T | null,
): (Omit<T, "avatarPath"> & { hasAvatar: boolean }) | null {
  return actor ? withHasAvatar(actor) : null;
}
