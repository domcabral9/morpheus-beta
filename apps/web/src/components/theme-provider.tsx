"use client";

import * as React from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-constants";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeClass(resolved: "light" | "dark"): void {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Substitui next-themes (Etapa 16.1 - hotfix): a versão instalada injeta uma
 * <script> tag via JSX dentro de um Client Component para evitar flash de
 * tema errado, e o React 19 passou a avisar sobre esse padrão ("Encountered
 * a script tag while rendering"), que o overlay de erro do Next em dev
 * mostra como bloqueante. O script anti-flash agora fica direto no
 * `<html>` do layout (Server Component, fora da árvore que o React
 * reconcilia no cliente - ver layout.tsx) e este provider vira só contexto
 * React puro, sem renderizar nenhum script.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    // Sincronização com localStorage no mount (mesmo caso de
    // assessments/[id]/page.tsx) - a regra experimental não consegue provar
    // estaticamente que isto não causa um loop de renderização (roda só uma
    // vez, array de dependências vazio).
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(stored);
    setResolvedTheme(stored === "system" ? getSystemTheme() : stored);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  React.useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    const resolved = next === "system" ? getSystemTheme() : next;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>.");
  return ctx;
}
