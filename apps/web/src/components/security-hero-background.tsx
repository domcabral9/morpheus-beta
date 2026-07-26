import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Fundo decorativo da tela de login - mesmo esquema de cores das telas
 * internas (tokens `background`/`foreground`/`primary` do tema, reage ao
 * alternador claro/escuro como qualquer outra tela), não mais escuro fixo.
 * Grade de pontos sutil + glow radial na cor de destaque do tema atrás do
 * conteúdo - tudo CSS puro, sem SVG/imagem externa.
 */
export function SecurityHeroBackground({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-full flex-1 flex-col overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-100"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl dark:opacity-40"
        style={{
          background: "radial-gradient(ellipse at center, var(--primary) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}
