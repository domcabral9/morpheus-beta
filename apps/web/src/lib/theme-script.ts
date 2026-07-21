import { THEME_STORAGE_KEY } from "@/lib/theme-constants";

/**
 * Renderizado como <script> puro direto no <html> do Server Component
 * layout.tsx (não dentro de ThemeProvider, que é Client Component) - roda
 * antes da hidratação, então aplicar a classe "dark" aqui não conflita com
 * o que o React reconcilia depois. Ver comentário completo em
 * theme-provider.tsx sobre por que isso saiu de dentro do ThemeProvider.
 */
export const themeAntiFlashScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
