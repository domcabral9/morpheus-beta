"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "@/i18n/navigation";

/** Reforça, por seção, a permissão que o item de sub-navegação já usa para se
 * esconder — protege contra acesso direto pela URL sem a permissão certa. */
export function AdminSectionGate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = user?.permissions.includes(permission) ?? false;

  React.useEffect(() => {
    if (user && !allowed) {
      router.replace("/admin");
    }
  }, [user, allowed, router]);

  if (!allowed) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
