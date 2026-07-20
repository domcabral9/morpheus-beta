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
    <header className="flex items-center justify-between border-b px-6 py-4">
      <span className="text-sm font-semibold tracking-tight">Morpheus</span>
      <div className="flex items-center gap-3">
        <LocaleSwitcher label="" />
        <ThemeToggle label="" />
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
