import * as React from "react";
import { cn } from "@/lib/utils";

const STATUS_CLASSES = {
  neutral: "text-foreground",
  good: "text-chart-good",
  warning: "text-chart-warning",
  critical: "text-chart-critical",
} as const;

export type StatTileStatus = keyof typeof STATUS_CLASSES;

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  status?: StatTileStatus;
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
}

/**
 * Número isolado + rótulo - a forma certa para "o valor atual de uma única
 * coisa" (ex.: quebras de SLA, taxa de aprovação), em vez de forçar isso
 * como um gráfico de uma barra só (ver skill de dataviz, "is it even a
 * chart?"). `status` só muda a cor do valor - o rótulo ao lado é sempre a
 * fonte do significado, nunca a cor sozinha.
 */
export function StatTile({ label, value, status = "neutral", icon, hint, className }: StatTileProps) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn("text-3xl font-semibold tabular-nums tracking-tight", STATUS_CLASSES[status])}
      >
        {value}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
