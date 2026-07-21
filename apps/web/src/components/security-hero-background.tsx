import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Fundo decorativo compartilhado por home e login - escuro fixo,
 * independente do alternador de tema (essas duas telas são a "vitrine" da
 * plataforma, não uso diário; personalidade própria, adaptada da estética
 * de segurança ofensiva que o usuário pediu para usar de referência, não
 * copiada literalmente). Grade de pontos sutil + glow vermelho radial atrás
 * do conteúdo - tudo CSS puro, sem SVG/imagem externa.
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
      className={cn("dark relative flex min-h-full flex-1 flex-col overflow-hidden bg-black", className)}
      style={{ "--hero-accent": "#e0263c" } as React.CSSProperties}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, var(--hero-accent) 0%, transparent 70%)",
        }}
      />
      <div className="relative flex flex-1 flex-col text-white">{children}</div>
    </div>
  );
}
