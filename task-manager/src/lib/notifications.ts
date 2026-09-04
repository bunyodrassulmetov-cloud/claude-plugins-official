import 'server-only';
import type { NotificationType } from '@prisma/client';
import { prisma } from './db';
import { sendTelegramNotifications } from './telegram';

type NotifyInput = {
  userId: number;
  type: NotificationType;
  title: string;
  body?: string;
  taskId?: number;
};

/** Уведомления пишутся в БД и показываются в шапке; себе уведомления не шлём. */
export async function notify(input: NotifyInput | NotifyInput[], actorId?: number) {
  const items = (Array.isArray(input) ? input : [input]).filter(
    (item) => item.userId && item.userId !== actorId,
  );
  if (items.length === 0) return;
  await prisma.notification.createMany({ data: items });
  // Телеграм — дополнительный канал: сбой доставки не должен ломать основную операцию
  await sendTelegramNotifications(items).catch((error) => console.error('[notify]', error));
}

export async function unreadCount(userId: number) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
