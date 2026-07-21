"use client";

import { useTranslations } from "next-intl";

import { useAuth } from "@/components/auth-provider";
import { Link } from "@/i18n/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_NAV_ITEMS } from "./_admin-nav";

export default function AdminIndexPage() {
  const t = useTranslations("Admin");
  const { user } = useAuth();
  const visibleItems = ADMIN_NAV_ITEMS.filter((item) =>
    user?.permissions.includes(item.permission),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-colors hover:border-foreground/30">
              <CardHeader>
                <CardTitle className="text-base">{t(item.labelKey)}</CardTitle>
                <CardDescription>{t(`${item.labelKey}Description`)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
