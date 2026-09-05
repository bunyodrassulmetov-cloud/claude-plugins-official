import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/auth';
import { canCommentTask } from '@/lib/permissions';
import { logActivity, taskInclude } from '@/lib/tasks';
import { notify } from '@/lib/notifications';
import {
  linkChatByCode,
  resolveTaskForReply,
  sendTelegramMessage,
  telegramEnabled,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const HELP =
  'Чтобы получать уведомления о задачах, откройте в приложении раздел «Профиль», ' +
  'скопируйте код привязки и отправьте его сюда командой:\n/start ВАШКОД';

/** Сотрудник, которому принадлежит чат. */
async function userByChat(chatId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId, isActive: true, approvalStatus: 'APPROVED' },
    include: { department: { select: { name: true } } },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    managerId: user.managerId,
  };
}

/** Текст сообщения превращается в заметку к задаче, о которой писал бот. */
async function addNoteFromChat(chatId: string, text: string, replyToMessageId?: number) {
  const user = await userByChat(chatId);
  if (!user) return 'Этот чат не привязан к учётной записи. Отправьте /start и код из «Профиля».';

  const taskId = await resolveTaskForReply(chatId, replyToMessageId);
  if (!taskId) {
    return 'Не понял, к какой задаче заметка. Ответьте (reply) на сообщение бота о нужной задаче.';
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) return 'Задача больше не существует.';
  if (!(await canCommentTask(user, task))) return 'Нет доступа к этой задаче.';

  await prisma.taskNote.create({ data: { taskId: task.id, authorId: user.id, body: text } });
  await logActivity(task.id, user.id, 'note_added', { source: 'telegram' });
  await notify(
    [task.assigneeId, task.acceptorId, task.customerId]
      .filter((id): id is number => typeof id === 'number')
      .map((userId) => ({
        userId,
        type: 'TASK_UPDATED' as const,
        taskId: task.id,
        title: 'Новая заметка к задаче',
        body: `«${task.title}»: ${text.slice(0, 120)}`,
      })),
    user.id,
  );

  return `Заметка добавлена к задаче «${task.title}».`;
}

/**
 * Точка приёма сообщений бота: привязка чата по коду и ответы, которые становятся заметками.
 * Адрес регистрируется у Telegram один раз (см. README), секрет проверяется по заголовку.
 */
export async function POST(request: NextRequest) {
  if (!telegramEnabled()) return NextResponse.json({ ok: true });

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    // Отвечаем 200: Telegram иначе будет повторять доставку бесконечно
    return NextResponse.json({ ok: true });
  }

  try {
    const update = (await request.json()) as {
      message?: {
        text?: string;
        chat?: { id?: number | string };
        reply_to_message?: { message_id?: number };
      };
    };
    const chat = update.message?.chat?.id;
    const text = update.message?.text?.trim() ?? '';
    if (!chat) return NextResponse.json({ ok: true });
    const chatId = String(chat);

    const start = text.match(/^\/start(?:\s+([A-Za-z0-9]{4,12}))?$/);
    if (start) {
      if (!start[1]) {
        await sendTelegramMessage(chatId, HELP);
        return NextResponse.json({ ok: true });
      }
      const user = await linkChatByCode(start[1], chatId);
      await sendTelegramMessage(
        chatId,
        user
          ? `Готово, ${user.fullName}. Сюда будут приходить новые задачи, напоминания о сроках и итоги дня.\n\n` +
              'Чтобы добавить заметку к задаче, ответьте (reply) на сообщение бота о ней.'
          : 'Код не подошёл. Он одноразовый — возьмите новый в разделе «Профиль».',
      );
      return NextResponse.json({ ok: true });
    }

    if (!text || text.startsWith('/')) {
      await sendTelegramMessage(chatId, HELP);
      return NextResponse.json({ ok: true });
    }

    const answer = await addNoteFromChat(
      chatId,
      text.slice(0, 5000),
      update.message?.reply_to_message?.message_id,
    );
    await sendTelegramMessage(chatId, answer);
  } catch (error) {
    console.error('[telegram webhook]', error);
  }

  return NextResponse.json({ ok: true });
}
