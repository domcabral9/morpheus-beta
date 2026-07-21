/**
 * Módulo sem "use client" de propósito - compartilhado entre theme-provider.tsx
 * (Client Component) e theme-script.ts (importado por um Server Component).
 * Importar uma constante direto de um arquivo "use client" a partir do lado
 * servidor quebrou silenciosamente (virou `undefined` no bundle do RSC) -
 * ver histórico do commit que corrigiu isto.
 */
export const THEME_STORAGE_KEY = "morpheus-theme";
