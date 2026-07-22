"use client";

import * as React from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { AccessTokenResponse, AuthenticatedUser } from "@/lib/auth-types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  status: AuthStatus;
  login: (params: { tenantSlug: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

// sessionStorage (não cookie/localStorage, de propósito): tab-scoped, nunca
// trafega pra rede, e some sozinho ao fechar a aba/navegador — combinado com
// a limpeza explícita em login()/logout() abaixo, evita que o "tenant sendo
// visto" de uma sessão vaze para outro usuário que faça login na mesma aba.
const VIEWING_TENANT_STORAGE_KEY = "morpheus_viewing_tenant_id";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");

  const loadUser = React.useCallback(async (token: string) => {
    const me = await apiFetch<AuthenticatedUser>("/auth/me", { accessToken: token });
    setUser(me);
    setAccessToken(token);
    setStatus("authenticated");
    return me;
  }, []);

  const switchTenant = React.useCallback(
    async (tenantId: string) => {
      const tokens = await apiFetch<AccessTokenResponse>("/auth/switch-tenant", {
        method: "POST",
        accessToken: accessToken ?? undefined,
        body: JSON.stringify({ tenantId }),
      });
      const me = await loadUser(tokens.accessToken);
      if (me.tenantId === me.homeTenantId) {
        sessionStorage.removeItem(VIEWING_TENANT_STORAGE_KEY);
      } else {
        sessionStorage.setItem(VIEWING_TENANT_STORAGE_KEY, me.tenantId);
      }
    },
    [accessToken, loadUser],
  );

  React.useEffect(() => {
    // Restaura a sessão ao carregar a página: o access token vive só em
    // memória (nunca em localStorage — reduz superfície de roubo via XSS),
    // então some a cada reload. O cookie httpOnly do refresh token sobrevive
    // e permite obter um novo access token silenciosamente.
    apiFetch<AccessTokenResponse>("/auth/refresh", { method: "POST" })
      .then(async (tokens) => {
        const me = await loadUser(tokens.accessToken);
        // /auth/refresh sempre volta pro tenant de casa (não há como o
        // refresh token "lembrar" uma sessão trocada) — se o usuário estava
        // visualizando outro tenant antes do reload, reaplica a troca aqui.
        // Falha (permissão revogada, tenant excluído) não quebra o app: só
        // limpa o valor salvo e segue na sessão de casa já carregada.
        const remembered = sessionStorage.getItem(VIEWING_TENANT_STORAGE_KEY);
        if (remembered && me.isSuperAdmin && remembered !== me.tenantId) {
          await switchTenant(remembered).catch(() => {
            sessionStorage.removeItem(VIEWING_TENANT_STORAGE_KEY);
          });
        }
      })
      .catch(() => setStatus("unauthenticated"));
    // switchTenant de propósito fora das deps: só deve rodar na restauração
    // de sessão do mount (referência estável o bastante via closure), não a
    // cada vez que accessToken muda e recria a função.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUser]);

  const login = React.useCallback(
    async (params: { tenantSlug: string; email: string; password: string }) => {
      sessionStorage.removeItem(VIEWING_TENANT_STORAGE_KEY);
      const tokens = await apiFetch<AccessTokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(params),
      });
      await loadUser(tokens.accessToken);
    },
    [loadUser],
  );

  const logout = React.useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    sessionStorage.removeItem(VIEWING_TENANT_STORAGE_KEY);
    setUser(null);
    setAccessToken(null);
    setStatus("unauthenticated");
  }, []);

  const value = React.useMemo(
    () => ({ user, accessToken, status, login, logout, switchTenant }),
    [user, accessToken, status, login, logout, switchTenant],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}

export { ApiError };
