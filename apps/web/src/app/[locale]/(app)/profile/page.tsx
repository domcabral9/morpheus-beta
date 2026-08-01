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
import type { OwnProfile } from "@/lib/profile-types";

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
            <Input id="profile-email" value={profile.email} disabled />
            <p className="text-xs text-muted-foreground">{t("fieldEmailHint")}</p>
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
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return <ProfileContent />;
}
