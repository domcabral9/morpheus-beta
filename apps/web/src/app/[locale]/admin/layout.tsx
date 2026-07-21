"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { AppHeader } from "@/components/app-header";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { AuthenticatedUser } from "@/lib/auth-types";
import { ADMIN_NAV_ITEMS } from "./_admin-nav";

function AdminSubNav({ user }: { user: AuthenticatedUser }) {
  const t = useTranslations("Admin");
  const pathname = usePathname();
  const visibleItems = ADMIN_NAV_ITEMS.filter((item) => user.permissions.includes(item.permission));

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b px-4 sm:px-6">
      {visibleItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
              active && "border-foreground font-medium text-foreground",
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useRequireAuth();
  const router = useRouter();
  const hasAnyAdminAccess = user
    ? ADMIN_NAV_ITEMS.some((item) => user.permissions.includes(item.permission))
    : false;

  React.useEffect(() => {
    if (user && !hasAnyAdminAccess) {
      router.replace("/dashboard");
    }
  }, [user, hasAnyAdminAccess, router]);

  if (!user || !hasAnyAdminAccess) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <AdminSubNav user={user} />
      <div className="flex flex-1 flex-col px-4 py-8 sm:px-6">{children}</div>
    </main>
  );
}
