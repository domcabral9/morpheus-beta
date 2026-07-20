"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const t = useTranslations("Dashboard");
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
      <span className="text-sm font-semibold tracking-tight">Morpheus</span>
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
