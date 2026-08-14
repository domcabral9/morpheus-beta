"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { useNotificationCount } from "@/lib/use-notification-count";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { NotificationRow } from "@/components/notification-row";
import type { Notification, NotificationsListResponse } from "@/lib/notification-types";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const t = useTranslations("Notifications");
  const user = useRequireAuth();
  const api = useApi();
  const { refresh } = useNotificationCount();

  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<NotificationsListResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [markingAll, setMarkingAll] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<NotificationsListResponse>(`/notifications?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(() => setError(t("loadError")));
  }, [api, page, t]);

  React.useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  if (!user) return null;

  function handleSelect(notification: Notification) {
    if (notification.isRead) return;
    api
      .patch(`/notifications/${notification.id}/read`)
      .then(() => {
        setData((current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === notification.id ? { ...item, isRead: true } : item,
                ),
              }
            : current,
        );
        refresh();
      })
      .catch(() => {});
  }

  function handleMarkAllAsRead() {
    setMarkingAll(true);
    api
      .patch("/notifications/read-all")
      .then(() => {
        setData((current) =>
          current
            ? { ...current, items: current.items.map((item) => ({ ...item, isRead: true })) }
            : current,
        );
        refresh();
      })
      .catch(() => {})
      .finally(() => setMarkingAll(false));
  }

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;
  const hasUnread = data?.items.some((item) => !item.isRead) ?? false;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("cardTitle")}</CardTitle>
          {hasUnread && (
            <Button variant="outline" size="sm" disabled={markingAll} onClick={handleMarkAllAsRead}>
              {t("markAllReadButton")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!error && !data && (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          )}

          {data && data.items.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
          )}

          {data && data.items.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                {data.items.map((item) => (
                  <NotificationRow key={item.id} notification={item} onSelect={handleSelect} />
                ))}
              </div>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                labels={{
                  previous: t("paginationPrevious"),
                  next: t("paginationNext"),
                  pageOf: (current, total) => t("paginationPageOf", { current, total }),
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
