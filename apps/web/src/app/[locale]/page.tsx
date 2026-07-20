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
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">{t("title")}</span>
        <div className="flex items-center gap-3">
          <LocaleSwitcher label={t("localeSwitcherLabel")} />
          <ThemeToggle label={t("themeToggleLabel")} />
          <Button asChild size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("subtitle")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <HealthStatus />
      </section>
    </main>
  );
}
