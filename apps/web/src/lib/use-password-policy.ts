"use client";

import * as React from "react";
import { useApi } from "@/lib/use-api";
import type { PlatformPasswordPolicy } from "@/lib/platform-policy-types";

/**
 * `GET /platform/password-policy` é aberto a qualquer usuário autenticado
 * (Fase 2) - são as regras vigentes, não quem as definiu, e todo mundo
 * precisa lê-las antes de definir/trocar uma senha. Falha silenciosa
 * (`catch` vazio) é aceitável aqui: sem a dica, o form ainda funciona, só
 * sem o texto de apoio - o backend valida de qualquer forma.
 */
export function usePasswordPolicy(): PlatformPasswordPolicy | null {
  const api = useApi();
  const [policy, setPolicy] = React.useState<PlatformPasswordPolicy | null>(null);

  React.useEffect(() => {
    api
      .get<PlatformPasswordPolicy>("/platform/password-policy")
      .then(setPolicy)
      .catch(() => {});
  }, [api]);

  return policy;
}
