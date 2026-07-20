import { useTranslations } from "next-intl";

import { HealthStatus } from "@/components/health-status";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function HomePage() {
  const t = useTranslations("HomePage");

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <span className="text-sm font-semibold tracking-tight">{t("title")}</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher label={t("localeSwitcherLabel")} />
          <ThemeToggle label={t("themeToggleLabel")} />
          <Button asChild size="sm">
            <Link href="/login">{t("enterButton")}</Link>
          </Button>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center sm:px-6 sm:py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("subtitle")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <HealthStatus />
      </section>
    </main>
  );
}
