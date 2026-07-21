"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color?: string }>;

interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart precisa estar dentro de <ChartContainer>.");
  return ctx;
}

/**
 * Injeta a cor de cada série como uma custom property CSS (--color-<key>) em
 * vez de passar hex direto pros componentes do recharts - assim os gráficos
 * reagem à troca de tema (claro/escuro) automaticamente, do mesmo jeito que
 * o resto da UI, sem precisar recalcular nada em JS no toggle.
 */
export function ChartContainer({
  config,
  className,
  children,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const colorVars = Object.fromEntries(
    Object.entries(config)
      .filter(([, value]) => value.color)
      .map(([key, value]) => [`--color-${key}`, value.color]),
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        className={cn(
          "h-full w-full text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line]:stroke-chart-grid",
          "[&_.recharts-reference-line_line]:stroke-chart-axis",
          className,
        )}
        style={{ ...colorVars, ...style }}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: Partial<RechartsPrimitive.TooltipContentProps<number, string>>) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-32 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {label !== undefined && <div className="mb-1 font-medium">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const itemConfig = config[key];
          const displayValue = formatter
            ? formatter(item.value as number, item.name as string, item, index, payload)
            : item.value;
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: item.color }}
                aria-hidden="true"
              />
              <span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
              <span className="ml-auto font-medium tabular-nums">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegendContent() {
  const { config } = useChart();
  const entries = Object.entries(config);
  if (entries.length < 2) return null; // uma série só - o título já identifica, sem legenda

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
      {entries.map(([key, item]) => (
        <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
