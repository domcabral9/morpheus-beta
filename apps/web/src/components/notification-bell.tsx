"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Bell, BellDot } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useApi } from "@/lib/use-api";
import { useNotificationCount } from "@/lib/use-notification-count";
import { NotificationRow } from "@/components/notification-row";
import type { Notification, NotificationsListResponse } from "@/lib/notification-types";

const DROPDOWN_PAGE_SIZE = 10;

export function NotificationBell({ label }: { label: string }) {
  const t = useTranslations("Notifications");
  const api = useApi();
  const { count, refresh } = useNotificationCount();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Notification[] | null>(null);
  const [markingAll, setMarkingAll] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    api
      .get<NotificationsListResponse>(`/notifications?pageSize=${DROPDOWN_PAGE_SIZE}`)
      .then((result) => setItems(result.items))
      .catch(() => setItems([]));
  }, [open, api]);

  function markRead(id: string) {
    setItems((current) =>
      current?.map((item) => (item.id === id ? { ...item, isRead: true } : item)) ?? current,
    );
    refresh();
  }

  function handleSelect(notification: Notification) {
    // Abrir o dropdown não marca nada como lido - só clicar numa
    // notificação específica (ou "marcar tudo") muda isRead.
    if (!notification.isRead) {
      api
        .patch(`/notifications/${notification.id}/read`)
        .then(() => markRead(notification.id))
        .catch(() => {});
    }
    setOpen(false);
  }

  function handleMarkAllAsRead() {
    setMarkingAll(true);
    api
      .patch("/notifications/read-all")
      .then(() => {
        setItems((current) => current?.map((item) => ({ ...item, isRead: true })) ?? current);
        refresh();
      })
      .catch(() => {})
      .finally(() => setMarkingAll(false));
  }

  const Icon = count > 0 ? BellDot : Bell;
  const hasUnread = items?.some((item) => !item.isRead) ?? false;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={label} className="relative">
          <Icon />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1.5 -right-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-medium">{t("dropdownTitle")}</span>
          {hasUnread && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markingAll}
              onClick={handleMarkAllAsRead}
            >
              {t("markAllReadButton")}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {!items && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>}
          {items && items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("emptyState")}</p>
          )}
          {items?.map((item) => (
            <NotificationRow key={item.id} notification={item} onSelect={handleSelect} />
          ))}
        </div>
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t px-3 py-2 text-center text-sm text-primary hover:bg-accent"
        >
          {t("viewAllLink")}
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
