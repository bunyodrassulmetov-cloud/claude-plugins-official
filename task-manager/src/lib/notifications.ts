import 'server-only';
import { after } from 'next/server';
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

  // Отправка в Telegram уходит за пределы ответа: иначе постановка задачи ждала бы
  // обращения к их серверу и выглядела как зависание на несколько секунд.
  const deliver = () =>
    sendTelegramNotifications(items).catch((error) => console.error('[notify]', error));
  try {
    after(deliver);
  } catch {
    // Вне контекста запроса (например, в скрипте) after() недоступен — отправляем сразу
    await deliver();
  }
}

export async function unreadCount(userId: number) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
