"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

import { useAuth, ApiError } from "@/components/auth-provider";
import { useRouter } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SecurityHeroBackground } from "@/components/security-hero-background";
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
    <SecurityHeroBackground>
      <main className="flex flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[var(--hero-accent)]" />
            <span className="text-sm font-bold tracking-wide">
              MORPHE<span className="text-[var(--hero-accent)]">US</span>
            </span>
          </div>
          <LocaleSwitcher label={t("localeSwitcherLabel")} />
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
          <Card className="w-full max-w-sm border-white/10 bg-zinc-950/80 shadow-[0_0_60px_-15px_var(--hero-accent)] backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl">{t("title")}</CardTitle>
              <CardDescription className="text-zinc-400">{t("subtitle")}</CardDescription>
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
                    className="border-white/15 bg-black/40 focus-visible:ring-[var(--hero-accent)]/50"
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
                    className="border-white/15 bg-black/40 focus-visible:ring-[var(--hero-accent)]/50"
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
                    className="border-white/15 bg-black/40 focus-visible:ring-[var(--hero-accent)]/50"
                    required
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-red-400">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 border border-[var(--hero-accent)] bg-[var(--hero-accent)]/10 text-white hover:bg-[var(--hero-accent)]/20"
                >
                  {submitting ? t("submitting") : t("submit")}
                </Button>
              </form>

              <div className="mt-6 flex items-center gap-3 text-xs text-zinc-500">
                <div className="h-px flex-1 bg-white/10" />
                {t("ssoDivider")}
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <Button
                variant="outline"
                className="mt-4 w-full border-white/15 bg-transparent text-white hover:bg-white/5"
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
