import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { SecurityHeroBackground } from "@/components/security-hero-background";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function HomePage() {
  const t = useTranslations("HomePage");

  return (
    <SecurityHeroBackground>
      <main className="flex flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[var(--hero-accent)]" />
            <span className="text-sm font-bold tracking-wide">
              MORPHE<span className="text-[var(--hero-accent)]">US</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher label={t("localeSwitcherLabel")} />
            <Button
              asChild
              size="sm"
              className="border border-[var(--hero-accent)] bg-[var(--hero-accent)]/10 text-white hover:bg-[var(--hero-accent)]/20"
            >
              <Link href="/login">{t("enterButton")}</Link>
            </Button>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center sm:px-6 sm:py-16">
          <div className="flex flex-col gap-3">
            <span className="mx-auto text-xs font-semibold tracking-[0.2em] text-[var(--hero-accent)] uppercase">
              {t("title")}
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{t("subtitle")}</h1>
            <p className="mx-auto max-w-md text-zinc-400">{t("description")}</p>
          </div>
        </section>
      </main>
    </SecurityHeroBackground>
  );
}
