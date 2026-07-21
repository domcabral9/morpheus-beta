"use client";

import * as React from "react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useRouter } from "@/i18n/navigation";
import { ADMIN_NAV_ITEMS } from "./_admin-nav";

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
    return null;
  }

  return <>{children}</>;
}
