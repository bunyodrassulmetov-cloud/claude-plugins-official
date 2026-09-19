import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { fail, handle, ok } from '@/lib/api';
import { config } from '@/lib/config';
import { forgotSchema, parseBody } from '@/lib/validation';
import { emailEnabled, sendEmail } from '@/lib/email';
import { issueResetToken } from '@/lib/password-reset';
import { clientIp, lockedForSeconds, registerFailure } from '@/lib/login-throttle';

/**
 * Запрос на восстановление пароля.
 * Ответ всегда одинаковый: по нему нельзя узнать, заведён ли такой адрес.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { data, error } = parseBody(forgotSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const ip = clientIp(request.headers);
    const locked = await lockedForSeconds('forgot', ip);
    if (locked) return fail('Слишком много запросов. Повторите позже.', 429);
    await registerFailure('forgot', ip);

    if (!emailEnabled()) {
      return fail('Отправка писем не настроена — обратитесь к администратору', 503);
    }

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (user && user.isActive && user.approvalStatus === 'APPROVED') {
      const { token, ttlMinutes } = await issueResetToken(user.id);
      const base = process.env.APP_URL ?? request.nextUrl.origin;
      await sendEmail(
        user.email,
        `Восстановление пароля — ${config.companyName}`,
        `${user.fullName}, здравствуйте.\n\n` +
          `Чтобы задать новый пароль, откройте ссылку:\n${base}/reset?token=${token}\n\n` +
          `Ссылка действует ${ttlMinutes} минут и срабатывает один раз.\n` +
          'Если вы не запрашивали смену пароля, просто не открывайте её — ничего не изменится.',
      );
    }

    return ok({ sent: true });
  });
}
