"use client";

import { useLocale } from "next-intl";

import { routing, type Locale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

const LOCALE_LABELS: Record<string, string> = {
  "pt-BR": "PT-BR",
  en: "EN",
};

export function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
        value={locale}
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value as Locale });
        }}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc] ?? loc}
          </option>
        ))}
      </select>
    </label>
  );
}
