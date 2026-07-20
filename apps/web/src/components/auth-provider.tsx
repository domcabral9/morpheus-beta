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
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthenticatedUser | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");

  const loadUser = React.useCallback(async (token: string) => {
    const me = await apiFetch<AuthenticatedUser>("/auth/me", { accessToken: token });
    setUser(me);
    setAccessToken(token);
    setStatus("authenticated");
  }, []);

  React.useEffect(() => {
    // Restaura a sessão ao carregar a página: o access token vive só em
    // memória (nunca em localStorage — reduz superfície de roubo via XSS),
    // então some a cada reload. O cookie httpOnly do refresh token sobrevive
    // e permite obter um novo access token silenciosamente.
    apiFetch<AccessTokenResponse>("/auth/refresh", { method: "POST" })
      .then((tokens) => loadUser(tokens.accessToken))
      .catch(() => setStatus("unauthenticated"));
  }, [loadUser]);

  const login = React.useCallback(
    async (params: { tenantSlug: string; email: string; password: string }) => {
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
    setUser(null);
    setAccessToken(null);
    setStatus("unauthenticated");
  }, []);

  const value = React.useMemo(
    () => ({ user, accessToken, status, login, logout }),
    [user, accessToken, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}

export { ApiError };
