import 'server-only';
import { prisma } from './db';

/**
 * Уведомления в Telegram. Работают, только если задан TELEGRAM_BOT_TOKEN —
 * без него всё молча остаётся как есть, приложение продолжает показывать
 * уведомления у себя.
 */
/** Адрес API вынесен в переменную: так его можно подменить на заглушку при проверке. */
const API = process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org';

export function telegramEnabled() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function telegramBotName() {
  return process.env.TELEGRAM_BOT_NAME ?? null;
}

async function callTelegram(method: string, payload: unknown) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const response = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Телеграм не должен задерживать ответ пользователю
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error('[telegram]', method, response.status, await response.text().catch(() => ''));
      return null;
    }
    return response.json();
  } catch (error) {
    console.error('[telegram]', method, error);
    return null;
  }
}

export async function sendTelegramMessage(chatId: string, text: string) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

/** Рассылка уведомлений тем, кто привязал чат. Ошибки не ломают основную операцию. */
export async function sendTelegramNotifications(
  items: { userId: number; title: string; body?: string | null; taskId?: number | null }[],
) {
  if (!telegramEnabled() || items.length === 0) return;

  const userIds = Array.from(new Set(items.map((item) => item.userId)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, telegramChatId: { not: null } },
    select: { id: true, telegramChatId: true },
  });
  if (users.length === 0) return;

  const chats = new Map(users.map((user) => [user.id, user.telegramChatId!]));
  await Promise.all(
    items
      .filter((item) => chats.has(item.userId))
      .map(async (item) => {
        const chatId = chats.get(item.userId)!;
        const text = item.body ? `${item.title}\n\n${item.body}` : item.title;
        const response = (await sendTelegramMessage(chatId, text)) as
          | { result?: { message_id?: number } }
          | null;

        // Ответ на это сообщение станет заметкой к задаче — запоминаем связь
        const messageId = response?.result?.message_id;
        if (messageId && item.taskId) {
          await prisma.telegramMessage
            .create({ data: { chatId, messageId, taskId: item.taskId } })
            .catch(() => undefined);
        }
      }),
  );
}

/** Задача, к которой относится ответ в чате: либо явный reply, либо последнее сообщение о задаче. */
export async function resolveTaskForReply(chatId: string, replyToMessageId?: number) {
  if (replyToMessageId) {
    const exact = await prisma.telegramMessage.findUnique({
      where: { chatId_messageId: { chatId, messageId: replyToMessageId } },
    });
    if (exact) return exact.taskId;
  }
  const recent = await prisma.telegramMessage.findFirst({
    where: { chatId, createdAt: { gte: new Date(Date.now() - 12 * 3_600_000) } },
    orderBy: { createdAt: 'desc' },
  });
  return recent?.taskId ?? null;
}

/** Код привязки: сотрудник отправляет его боту, чат сохраняется за ним. */
export async function issueLinkCode(userId: number) {
  const code = Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)],
  ).join('');
  await prisma.user.update({ where: { id: userId }, data: { telegramLinkCode: code } });
  return code;
}

export async function linkChatByCode(code: string, chatId: string) {
  const user = await prisma.user.findUnique({ where: { telegramLinkCode: code.toUpperCase() } });
  if (!user || !user.isActive) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: chatId, telegramLinkCode: null },
  });
  return user;
}
