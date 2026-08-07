"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";

import { useApi } from "@/lib/use-api";
import { ApiError } from "@/lib/api-client";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_CATEGORIES,
  ATTACHMENT_MAX_SIZE_BYTES,
  type AttachmentCategory,
  type AttachmentDetail,
  type AttachmentParent,
} from "@/lib/attachment-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AttachmentsPanelProps {
  parent: AttachmentParent;
  canUpload: boolean;
}

/** Painel de anexos (contrato, DPA, relatório SOC2, certificado ISO 27001,
 * relatório de pentest, etc.) - reaproveitado tanto em Assessment quanto em
 * Inventário, já que o backend (`AttachmentsModule`) trata os dois pais de
 * forma simétrica. */
export function AttachmentsPanel({ parent, canUpload }: AttachmentsPanelProps) {
  const t = useTranslations("Attachments");
  const api = useApi();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [items, setItems] = React.useState<AttachmentDetail[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<AttachmentCategory>("OTHER");
  const [uploading, setUploading] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const query =
    "assessmentId" in parent
      ? `assessmentId=${encodeURIComponent(parent.assessmentId)}`
      : `inventoryItemId=${encodeURIComponent(parent.inventoryItemId)}`;

  const load = React.useCallback(() => {
    return api
      .get<AttachmentDetail[]>(`/attachments?${query}`)
      .then((result) => {
        setItems(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, query, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
      toast.error(t("uploadTooLarge"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      if ("assessmentId" in parent) {
        formData.append("assessmentId", parent.assessmentId);
      } else {
        formData.append("inventoryItemId", parent.inventoryItemId);
      }
      await api.postForm<AttachmentDetail>("/attachments", formData);
      toast.success(t("uploadSuccess"));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachment: AttachmentDetail) {
    setDownloadingId(attachment.id);
    try {
      const blob = await api.getBlob(`/attachments/${attachment.id}/download`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = attachment.fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error(t("downloadError"));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canUpload && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2 sm:w-64">
              <span className="text-xs text-muted-foreground">{t("categoryLabel")}</span>
              <Select value={category} onValueChange={(value) => setCategory(value as AttachmentCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTACHMENT_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`categories.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
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
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              {uploading ? t("uploading") : t("uploadButton")}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && !items && (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        )}

        {items && items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}

        {items && items.length > 0 && (
          <ul className="flex flex-col divide-y">
            {items.map((attachment) => (
              <li
                key={attachment.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{attachment.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`categories.${attachment.category}`)} · v{attachment.version} ·{" "}
                    {attachment.uploadedBy.name} ·{" "}
                    {new Date(attachment.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {attachment.version > 1 && (
                    <Badge variant="outline" className="text-[10px]">
                      {t("versionBadge", { version: attachment.version })}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={downloadingId === attachment.id}
                    onClick={() => handleDownload(attachment)}
                  >
                    {downloadingId === attachment.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Download />
                    )}
                    {t("downloadButton")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
