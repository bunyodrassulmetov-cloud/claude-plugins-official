import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { verifyInitData } from '@/lib/telegram-initdata';

/**
 * Привязка Telegram к уже открытой сессии — то же, что код /start,
 * но без переписки с ботом: человек один раз вошёл по паролю прямо
 * в мини-приложении, и дальше входит молча.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { initData?: string };
    const result = verifyInitData(body.initData ?? '', process.env.TELEGRAM_BOT_TOKEN ?? '');
    if (!result.ok) return fail('Не удалось подтвердить данные Telegram', 401);

    const chatId = String(result.user.id);
    const taken = await prisma.user.findFirst({
      where: { telegramChatId: chatId, NOT: { id: user.id } },
      select: { id: true },
    });
    if (taken) return fail('Этот Telegram уже связан с другой учётной записью', 409);

    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: chatId, telegramLinkCode: null },
    });
    return ok({ success: true });
  });
}
