"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "loading" | "healthy" | "unhealthy";

export function HealthStatus() {
  const t = useTranslations("HealthStatus");
  const [status, setStatus] = React.useState<Status>("loading");

  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      setStatus(response.ok ? "healthy" : "unhealthy");
    } catch {
      setStatus("unhealthy");
    }
  }, []);

  React.useEffect(() => {
    // Fetch-on-mount idiomático; setStatus só roda depois do await dentro de
    // fetchStatus, mas a regra experimental do react-hooks não consegue provar
    // isso estaticamente. Sem uma lib de data-fetching (fora de escopo na Etapa 1).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStatus();
  }, [fetchStatus]);

  const retry = () => {
    setStatus("loading");
    void fetchStatus();
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === "loading" && <Loader2 className="animate-spin text-muted-foreground" />}
          {status === "healthy" && <CheckCircle2 className="text-success" />}
          {status === "unhealthy" && <XCircle className="text-destructive" />}
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {status === "loading" && t("checking")}
          {status === "healthy" && t("healthy")}
          {status === "unhealthy" && t("unhealthy")}
        </p>
        {status === "unhealthy" && (
          <Button size="sm" variant="outline" onClick={retry}>
            {t("retry")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
