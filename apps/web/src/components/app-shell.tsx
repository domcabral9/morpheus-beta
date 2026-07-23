"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { CommandPalette } from "@/components/command-palette";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function AppShell({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("Nav");
  const paletteT = useTranslations("CommandPalette");
  const user = useRequireAuth();
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  if (!user) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 sm:px-6">
          <div className="flex flex-1 items-center gap-2">
            <SidebarTrigger aria-label={t("toggleSidebarLabel")} />
            <Separator orientation="vertical" className="h-4" />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex w-full max-w-64 items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Search className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">{paletteT("title")}</span>
              <span className="hidden items-center gap-0.5 sm:flex">
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium">
                  Ctrl
                </kbd>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium">
                  K
                </kbd>
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher label={t("localeSwitcherLabel")} />
            <ThemeToggle label={t("themeToggleLabel")} />
          </div>
        </header>
        <ImpersonationBanner />
        <main className="flex flex-1 flex-col px-4 py-8 sm:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
