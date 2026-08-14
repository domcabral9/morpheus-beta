"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  formatNotificationData,
  resolveNotificationHref,
  type Notification,
} from "@/lib/notification-types";

interface NotificationRowProps {
  notification: Notification;
  /** Chamado em todo clique (mesmo em item já lido) - o componente decide se marca como lida. */
  onSelect: (notification: Notification) => void;
}

/**
 * Linha de notificação compartilhada entre o dropdown do sino e a página
 * `/notifications` - resolve título/corpo via `data`+i18n (fallback pro
 * `title`/`body` legado quando `data` for nulo) e navega por
 * `relatedEntityType` ao clicar.
 */
export function NotificationRow({ notification, onSelect }: NotificationRowProps) {
  const locale = useLocale();
  const t = useTranslations("Notifications.messages");

  let title: string;
  let body: string;
  if (notification.data) {
    const values = formatNotificationData(notification.type, notification.data, locale);
    title = t(`${notification.type}.title`, values);
    body = t(`${notification.type}.body`, values);
  } else {
    title = notification.title ?? "";
    body = notification.body ?? "";
  }

  const href = resolveNotificationHref(notification);
  const className = cn(
    "block w-full rounded-md text-left transition-colors hover:bg-accent",
    !notification.isRead && "bg-accent/40",
  );

  const content = (
    <span className="flex w-full flex-col items-start gap-0.5 px-3 py-2">
      <span className="flex w-full items-center gap-2">
        {!notification.isRead && (
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        )}
        <span className={cn("flex-1 truncate text-sm", !notification.isRead && "font-semibold")}>
          {title}
        </span>
      </span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{body}</span>
      <span className="text-[11px] text-muted-foreground">
        {new Date(notification.createdAt).toLocaleString(locale)}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} onClick={() => onSelect(notification)} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onSelect(notification)} className={className}>
      {content}
    </button>
  );
}
