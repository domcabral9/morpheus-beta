"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useAuth, ApiError } from "@/components/auth-provider";
import { useRouter } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const t = useTranslations("LoginPage");
  const { login, status, user } = useAuth();
  const router = useRouter();

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
    <main className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">{t("title")}</span>
        <div className="flex items-center gap-3">
          <LocaleSwitcher label={t("localeSwitcherLabel")} />
          <ThemeToggle label={t("themeToggleLabel")} />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="tenantSlug">{t("tenantSlugLabel")}</Label>
                <Input
                  id="tenantSlug"
                  name="tenantSlug"
                  placeholder={t("tenantSlugPlaceholder")}
                  value={tenantSlug}
                  onChange={(event) => setTenantSlug(event.target.value)}
                  required
                />
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
  );
}
