"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";

/**
 * Wrapper de apiFetch já com o access token da sessão atual. Componentes de
 * página chamam `api.get("/assessments")` em vez de lidar com o token toda
 * hora — centraliza esse detalhe num único lugar.
 */
export function useApi() {
  const { accessToken } = useAuth();

  return React.useMemo(
    () => ({
      get: <T,>(path: string) => apiFetch<T>(path, { accessToken: accessToken ?? undefined }),
      post: <T,>(path: string, body?: unknown) =>
        apiFetch<T>(path, {
          method: "POST",
          accessToken: accessToken ?? undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
      patch: <T,>(path: string, body?: unknown) =>
        apiFetch<T>(path, {
          method: "PATCH",
          accessToken: accessToken ?? undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
      put: <T,>(path: string, body?: unknown) =>
        apiFetch<T>(path, {
          method: "PUT",
          accessToken: accessToken ?? undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
      delete: <T,>(path: string) =>
        apiFetch<T>(path, { method: "DELETE", accessToken: accessToken ?? undefined }),
    }),
    [accessToken],
  );
}
