"use client";

import * as React from "react";
import { useApi } from "@/lib/use-api";
import type { UnreadCountResponse } from "@/lib/notification-types";

const POLL_INTERVAL_MS = 60_000;

/**
 * Contagem de não lidas, atualizada por polling simples (`setInterval`) -
 * sem lib de data-fetching nova, mesmo padrão de todo o resto do projeto
 * (zero react-query/SWR hoje). `refresh()` é exposto pra recontagem
 * otimista (ex. logo após "marcar tudo como lido"), sem esperar o próximo
 * tick. Falha silenciosa (`catch` vazio) é aceitável aqui - mesma filosofia
 * de `usePasswordPolicy`: sem o número, o sino ainda funciona, só sem badge.
 */
export function useNotificationCount(): { count: number; refresh: () => void } {
  const api = useApi();
  const [count, setCount] = React.useState(0);

  const refresh = React.useCallback(() => {
    api
      .get<UnreadCountResponse>("/notifications/unread-count")
      .then((result) => setCount(result.count))
      .catch(() => {});
  }, [api]);

  React.useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, refresh };
}
