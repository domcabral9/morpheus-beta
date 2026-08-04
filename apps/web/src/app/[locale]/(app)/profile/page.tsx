"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { useAuth, ApiError } from "@/components/auth-provider";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OwnProfile } from "@/lib/profile-types";
import type { TwoFactorSetup, TwoFactorEnrollmentResult } from "@/lib/two-factor-types";

const identitySchema = z.object({ name: z.string().min(1) });
type IdentityFormValues = z.infer<typeof identitySchema>;

const ALLOWED_AVATAR_TYPES = "image/png,image/jpeg";
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

function IdentityCard({
  profile,
  onSaved,
}: {
  profile: OwnProfile;
  onSaved: (profile: OwnProfile) => void;
}) {
  const t = useTranslations("Profile");
  const api = useApi();
  const { refreshUser } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { name: profile.name },
  });

  async function onSubmit(values: IdentityFormValues) {
    try {
      const updated = await api.patch<OwnProfile>("/auth/profile", values);
      toast.success(t("saveSuccess"));
      onSaved(updated);
      // Sem isto o nome ficaria "stale" na sidebar até o próximo login - mesmo
      // /auth/refresh já usado na restauração de sessão, só que sob demanda.
      await refreshUser();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveError"));
    }
  }

  // Verificação de e-mail (passwordless, Fase 5) - badge + mini-fluxo inline
  // dentro deste card, de propósito (não um card novo): evita piorar o item
  // já sinalizado no backlog de "/profile está longo demais".
  const [emailVerifyStep, setEmailVerifyStep] = React.useState<"idle" | "code">("idle");
  const [emailCode, setEmailCode] = React.useState("");
  const [emailVerifySubmitting, setEmailVerifySubmitting] = React.useState(false);

  async function handleRequestEmailVerification() {
    setEmailVerifySubmitting(true);
    try {
      await api.post("/auth/email/verify/request");
      setEmailVerifyStep("code");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("emailVerifyGenericError"));
    } finally {
      setEmailVerifySubmitting(false);
    }
  }

  // Botão comum (não `type="submit"`) de propósito: este bloco vive dentro
  // do <form> do nome/identidade acima, e HTML não permite <form> aninhado -
  // um <form> interno aqui foi tentado e causou um bug real (o clique
  // borbulhava pro <form> externo, disparando um submit nativo de página
  // inteira em vez de chamar a API - achado confirmado via teste manual).
  async function handleConfirmEmailVerification() {
    setEmailVerifySubmitting(true);
    try {
      const updated = await api.post<OwnProfile>("/auth/email/verify/confirm", { code: emailCode });
      onSaved(updated);
      toast.success(t("emailVerifySuccess"));
      setEmailVerifyStep("idle");
      setEmailCode("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("emailVerifyGenericError"));
    } finally {
      setEmailVerifySubmitting(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{t("identityCardTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-name">{t("fieldName")}</Label>
            <Input id="profile-name" {...register("name")} aria-invalid={!!errors.name} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-email">{t("fieldEmail")}</Label>
            <div className="flex items-center gap-2">
              <Input id="profile-email" value={profile.email} disabled className="flex-1" />
              {profile.emailVerified ? (
                <Badge variant="success">{t("emailVerifiedBadge")}</Badge>
              ) : (
                <Badge variant="outline">{t("emailNotVerifiedBadge")}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("fieldEmailHint")}</p>

            {!profile.emailVerified && emailVerifyStep === "idle" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={emailVerifySubmitting}
                onClick={handleRequestEmailVerification}
              >
                {emailVerifySubmitting ? t("emailVerifyRequesting") : t("emailVerifyButton")}
              </Button>
            )}

            {emailVerifyStep === "code" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="emailVerifyCode">{t("emailVerifyCodeLabel")}</Label>
                  <Input
                    id="emailVerifyCode"
                    className="max-w-32"
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleConfirmEmailVerification();
                      }
                    }}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={emailVerifySubmitting}
                    onClick={handleConfirmEmailVerification}
                  >
                    {emailVerifySubmitting
                      ? t("emailVerifyConfirming")
                      : t("emailVerifyConfirmButton")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEmailVerifyStep("idle");
                      setEmailCode("");
                    }}
                  >
                    {t("emailVerifyCancelButton")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">{t("rolesLabel")}</dt>
              <dd>{profile.roles.join(", ")}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">{t("memberSinceLabel")}</dt>
              <dd>{new Date(profile.createdAt).toLocaleDateString()}</dd>
            </div>
            {profile.lastLoginAt && (
              <div>
                <dt className="font-medium text-foreground">{t("lastLoginLabel")}</dt>
                <dd>{new Date(profile.lastLoginAt).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>

          <div>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AvatarCard({
  profile,
  onUploaded,
}: {
  profile: OwnProfile;
  onUploaded: (profile: OwnProfile) => void;
}) {
  const t = useTranslations("Profile");
  const api = useApi();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!profile.hasAvatar) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    api
      .getBlob("/auth/avatar")
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => setPreviewUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, profile.hasAvatar]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error(t("avatarUploadError"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await api.postForm<OwnProfile>("/auth/avatar", formData);
      toast.success(t("avatarUploadSuccess"));
      onUploaded(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("avatarUploadError"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{t("avatarCardTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview vem de blob:, não do otimizador de imagens do Next.
            <img
              src={previewUrl}
              alt={t("avatarPreviewAlt")}
              className="size-16 rounded-full border object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-full border text-xs text-muted-foreground">
              {t("avatarNoneSet")}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_AVATAR_TYPES}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? t("avatarUploading") : t("avatarUploadButton")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordCard({ profile }: { profile: OwnProfile }) {
  const t = useTranslations("Profile");
  const changePasswordT = useTranslations("ChangePassword");

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{changePasswordT("dialogTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {profile.hasLocalPassword ? (
          <ChangePasswordForm />
        ) : (
          <p className="text-sm text-muted-foreground">{t("ssoOnlyNotice")}</p>
        )}
      </CardContent>
    </Card>
  );
}

type TwoFactorStep =
  | "idle"
  | "enroll-setup"
  | "enroll-backup-codes"
  | "disable-reauth"
  | "regenerate-reauth"
  | "regenerate-backup-codes";

function TwoFactorCard({
  profile,
  onProfileChange,
}: {
  profile: OwnProfile;
  onProfileChange: (profile: OwnProfile) => void;
}) {
  const t = useTranslations("Profile");
  const api = useApi();

  const [step, setStep] = React.useState<TwoFactorStep>("idle");
  const [setup, setSetup] = React.useState<TwoFactorSetup | null>(null);
  const [code, setCode] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  function resetToIdle() {
    setStep("idle");
    setSetup(null);
    setCode("");
    setCurrentPassword("");
    setBackupCodes([]);
  }

  async function handleStartEnroll() {
    setSubmitting(true);
    try {
      const result = await api.post<TwoFactorSetup>("/auth/2fa/setup");
      setSetup(result);
      setStep("enroll-setup");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("twoFactorGenericError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmEnroll(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.post<TwoFactorEnrollmentResult>("/auth/2fa/enable", { code });
      setBackupCodes(result.backupCodes);
      setStep("enroll-backup-codes");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("twoFactorGenericError"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinishEnroll() {
    onProfileChange({ ...profile, hasTwoFactorEnabled: true });
    toast.success(t("twoFactorEnableSuccess"));
    resetToIdle();
  }

  async function handleConfirmDisable(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const updated = await api.patch<OwnProfile>("/auth/2fa/disable", { currentPassword });
      onProfileChange(updated);
      toast.success(t("twoFactorDisableSuccess"));
      resetToIdle();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("twoFactorGenericError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmRegenerate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.post<TwoFactorEnrollmentResult>(
        "/auth/2fa/backup-codes/regenerate",
        { currentPassword },
      );
      setBackupCodes(result.backupCodes);
      setStep("regenerate-backup-codes");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("twoFactorGenericError"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinishRegenerate() {
    toast.success(t("twoFactorRegenerateSuccess"));
    resetToIdle();
  }

  async function handleCopySecret() {
    if (!setup) return;
    await navigator.clipboard.writeText(setup.secretBase32);
    toast.success(t("twoFactorSecretCopied"));
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">{t("twoFactorCardTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {profile.twoFactorEnforced && !profile.hasTwoFactorEnabled && step === "idle" && (
          <p className="rounded-md border border-chart-warning/50 bg-chart-warning/10 px-3 py-2 text-sm">
            {t("twoFactorEnforcedNotice")}
          </p>
        )}

        {step === "idle" && (
          <>
            <div>
              {profile.hasTwoFactorEnabled ? (
                <Badge variant="success">{t("twoFactorEnabledBadge")}</Badge>
              ) : (
                <Badge variant="outline">{t("twoFactorDisabledBadge")}</Badge>
              )}
            </div>
            {profile.hasTwoFactorEnabled ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("disable-reauth")}
                >
                  {t("twoFactorDisableButton")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("regenerate-reauth")}
                >
                  {t("twoFactorRegenerateButton")}
                </Button>
              </div>
            ) : (
              <div>
                <Button type="button" size="sm" disabled={submitting} onClick={handleStartEnroll}>
                  {submitting ? t("twoFactorStarting") : t("twoFactorEnableButton")}
                </Button>
              </div>
            )}
          </>
        )}

        {step === "enroll-setup" && setup && (
          <form onSubmit={handleConfirmEnroll} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("twoFactorSetupSubtitle")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR vem de data URL gerado pelo backend, não do otimizador de imagens do Next. */}
            <img
              src={setup.qrCodeDataUrl}
              alt={t("twoFactorQrAlt")}
              className="size-40 self-center rounded border"
            />
            <div className="flex flex-col gap-2">
              <Label>{t("twoFactorSecretLabel")}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded border bg-muted px-2 py-1 text-xs">
                  {setup.secretBase32}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={handleCopySecret}>
                  {t("twoFactorCopyButton")}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="twoFactorCode">{t("twoFactorCodeLabel")}</Label>
              <Input
                id="twoFactorCode"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={t("twoFactorCodePlaceholder")}
                autoComplete="one-time-code"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? t("twoFactorConfirming") : t("twoFactorConfirmButton")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetToIdle}>
                {t("twoFactorCancelButton")}
              </Button>
            </div>
          </form>
        )}

        {(step === "enroll-backup-codes" || step === "regenerate-backup-codes") && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-destructive">{t("twoFactorBackupCodesWarning")}</p>
            <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
              {backupCodes.map((backupCode) => (
                <li key={backupCode}>{backupCode}</li>
              ))}
            </ul>
            <div>
              <Button
                type="button"
                size="sm"
                onClick={step === "enroll-backup-codes" ? handleFinishEnroll : handleFinishRegenerate}
              >
                {t("twoFactorBackupCodesSavedButton")}
              </Button>
            </div>
          </div>
        )}

        {(step === "disable-reauth" || step === "regenerate-reauth") && (
          <form
            onSubmit={step === "disable-reauth" ? handleConfirmDisable : handleConfirmRegenerate}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="twoFactorReauthPassword">{t("twoFactorReauthPasswordLabel")}</Label>
              <Input
                id="twoFactorReauthPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                variant={step === "disable-reauth" ? "destructive" : "default"}
                disabled={submitting}
              >
                {submitting
                  ? t("twoFactorConfirming")
                  : step === "disable-reauth"
                    ? t("twoFactorDisableButton")
                    : t("twoFactorRegenerateButton")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetToIdle}>
                {t("twoFactorCancelButton")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileContent() {
  const t = useTranslations("Profile");
  const api = useApi();

  const [profile, setProfile] = React.useState<OwnProfile | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<OwnProfile>("/auth/profile")
      .then((result) => {
        setProfile(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, t]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && !profile && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {profile && (
        <div className="flex flex-col gap-6">
          <IdentityCard profile={profile} onSaved={setProfile} />
          <AvatarCard profile={profile} onUploaded={setProfile} />
          <PasswordCard profile={profile} />
          <TwoFactorCard profile={profile} onProfileChange={setProfile} />
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return <ProfileContent />;
}
