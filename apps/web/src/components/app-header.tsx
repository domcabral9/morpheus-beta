"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "assessmentsLink" },
  { href: "/dashboards", labelKey: "dashboardsLink" },
] as const;

export function AppHeader() {
  const t = useTranslations("Dashboard");
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold tracking-tight">Morpheus</span>
        <nav className="flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname === item.href && "font-medium text-foreground",
              )}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <LocaleSwitcher label={t("localeSwitcherLabel")} />
        <ThemeToggle label={t("themeToggleLabel")} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void logout().then(() => router.replace("/login"));
          }}
        >
          {t("signOut")}
        </Button>
      </div>
    </header>
  );
}
