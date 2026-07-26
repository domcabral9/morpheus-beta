"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

import { useAuth, ApiError } from "@/components/auth-provider";
import { useApi } from "@/lib/use-api";
import { useRouter } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { SecurityHeroBackground } from "@/components/security-hero-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TenantPublicSummary } from "@/lib/auth-types";

export default function LoginPage() {
  const t = useTranslations("LoginPage");
  const { login, status, user } = useAuth();
  const api = useApi();
  const router = useRouter();

  const [tenants, setTenants] = React.useState<TenantPublicSummary[] | null>(null);
  const [tenantSlug, setTenantSlug] = React.useState("demo");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  React.useEffect(() => {
    api
      .get<TenantPublicSummary[]>("/tenants/public")
      .then((result) => {
        setTenants(result);
        if (result.length > 0 && !result.some((item) => item.slug === "demo")) {
          setTenantSlug(result[0].slug);
        }
      })
      .catch(() => setTenants([]));
  }, [api]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ tenantSlug, email, password });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SecurityHeroBackground>
      <main className="flex flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <span className="text-sm font-bold tracking-wide">
              MORPHE<span className="text-primary">US</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher label={t("localeSwitcherLabel")} />
            <ThemeToggle label={t("themeToggleLabel")} />
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 sm:px-6">
          <p className="text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {t("tagline")}
          </p>

          <Card className="w-full max-w-sm gap-7 py-7 shadow-lg backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-3xl tracking-tight">{t("title")}</CardTitle>
              <CardDescription>{t("subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tenantSlug">{t("tenantSlugLabel")}</Label>
                  <Select value={tenantSlug} onValueChange={setTenantSlug} disabled={!tenants}>
                    <SelectTrigger id="tenantSlug">
                      <SelectValue placeholder={t("tenantSelectPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(tenants ?? []).map((tenant) => (
                        <SelectItem key={tenant.slug} value={tenant.slug}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("tenantSlugHint")}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("emailLabel")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t("passwordLabel")}</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" disabled={submitting} className="mt-2">
                  {submitting ? t("submitting") : t("submit")}
                </Button>
              </form>

              <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                {t("ssoDivider")}
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => {
                  window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auth/saml/login`;
                }}
              >
                {t("ssoButton")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </SecurityHeroBackground>
  );
}
