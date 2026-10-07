import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSessionCookie } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { verifyInitData } from '@/lib/telegram-initdata';

/**
 * Вход в мини-приложении Telegram: без логина и пароля.
 * Доверяем не тому, что прислал браузер, а подписи Telegram — она сделана
 * ключом от токена бота, подделать её, не зная токена, нельзя.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = (await request.json().catch(() => ({}))) as { initData?: string };
    const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
    const result = verifyInitData(body.initData ?? '', token);

    if (!result.ok) {
      const message =
        result.reason === 'expired'
          ? 'Сессия Telegram устарела — закройте и откройте приложение заново'
          : 'Не удалось подтвердить, что приложение открыто из Telegram';
      return fail(message, 401);
    }

    const user = await prisma.user.findFirst({
      where: {
        telegramChatId: String(result.user.id),
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    });

    // Учётная запись ещё не связана с этим Telegram — это не ошибка,
    // интерфейс предложит войти один раз по email и свяжет аккаунты сам
    if (!user) return fail('Этот Telegram пока не связан с учётной записью', 404);

    await createSessionCookie(user);
    return ok({ id: user.id, fullName: user.fullName, role: user.role });
  });
}
