"use client";

import { Moon, Sun, SunMoon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useMounted } from "@/lib/use-mounted";

const THEME_ORDER = ["light", "dark", "system"] as const;
const THEME_ICON = { light: Sun, dark: Moon, system: SunMoon } as const;

export function ThemeToggle({ label }: { label: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const current = mounted ? (theme as (typeof THEME_ORDER)[number] | undefined) ?? "system" : "system";
  const Icon = THEME_ICON[current];

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      disabled={!mounted}
      onClick={() => {
        const nextIndex = (THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length;
        setTheme(THEME_ORDER[nextIndex]);
      }}
    >
      <Icon />
    </Button>
  );
}
