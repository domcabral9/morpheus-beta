"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useApi } from "@/lib/use-api";

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

/**
 * Avatar de usuário com busca de imagem via blob (mesmo padrão do `AvatarCard`
 * de `/profile`). `avatarUrl` é o caminho já resolvido pelo chamador - próprio
 * usuário sempre usa `/auth/avatar` (sem custo de checar `hasAvatar` antes,
 * só uma requisição por sessão); avatar de outro usuário usa
 * `/users/:id/avatar` só quando `hasAvatar` é true, pra não gastar uma
 * requisição fadada a 404 em toda linha de tabela.
 */
export function UserAvatar({
  name,
  avatarUrl,
  size = "default",
  className,
  fallbackClassName,
}: {
  name: string | null | undefined;
  avatarUrl: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
  fallbackClassName?: string;
}) {
  const api = useApi();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!avatarUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    api
      .getBlob(avatarUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, avatarUrl]);

  return (
    <Avatar size={size} className={className}>
      {previewUrl ? <AvatarImage src={previewUrl} alt={name ?? ""} /> : null}
      <AvatarFallback className={fallbackClassName}>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
