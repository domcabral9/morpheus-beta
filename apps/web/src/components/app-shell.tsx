"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImpersonationBanner } from "@/components/impersonation-banner";
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
  const user = useRequireAuth();

  if (!user) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger aria-label={t("toggleSidebarLabel")} />
            <Separator orientation="vertical" className="h-4" />
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
