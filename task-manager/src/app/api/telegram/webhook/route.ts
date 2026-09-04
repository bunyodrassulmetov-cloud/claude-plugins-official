import { NextRequest, NextResponse } from 'next/server';
import { linkChatByCode, sendTelegramMessage, telegramEnabled } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * Точка приёма сообщений бота. Отвечает на «/start КОД» привязкой чата к сотруднику.
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
      message?: { text?: string; chat?: { id?: number | string } };
    };
    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim() ?? '';
    if (!chatId) return NextResponse.json({ ok: true });

    const match = text.match(/^\/start\s+([A-Za-z0-9]{4,12})$/);
    if (!match) {
      await sendTelegramMessage(
        String(chatId),
        'Чтобы получать уведомления о задачах, откройте в приложении раздел «Профиль», ' +
          'скопируйте код привязки и отправьте его сюда командой:\n/start ВАШКОД',
      );
      return NextResponse.json({ ok: true });
    }

    const user = await linkChatByCode(match[1], String(chatId));
    await sendTelegramMessage(
      String(chatId),
      user
        ? `Готово, ${user.fullName}. Сюда будут приходить новые задачи, напоминания о сроках и просрочки.`
        : 'Код не подошёл. Он одноразовый — возьмите новый в разделе «Профиль».',
    );
  } catch (error) {
    console.error('[telegram webhook]', error);
  }

  return NextResponse.json({ ok: true });
}
