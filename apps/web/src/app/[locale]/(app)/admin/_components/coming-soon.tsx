"use client";

import { useTranslations } from "next-intl";

/** Placeholder para seções de /admin cuja tela ainda não foi construída
 * (etapa futura do plano) — o link já existe no shell, só o conteúdo virá
 * depois, etapa por etapa. */
export function ComingSoon({ titleKey }: { titleKey: string }) {
  const t = useTranslations("Admin");

  return (
    <div className="flex flex-1 flex-col gap-2">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t(titleKey)}</h1>
      <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
    </div>
  );
}
