"use client";

import * as React from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "@/i18n/navigation";
import type { AuthenticatedUser } from "@/lib/auth-types";

/** Redireciona para /login quando não há sessão. Páginas protegidas chamam
 * isso e renderizam um spinner enquanto `user` for null. */
export function useRequireAuth(): AuthenticatedUser | null {
  const { user, status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  return status === "authenticated" ? user : null;
}
