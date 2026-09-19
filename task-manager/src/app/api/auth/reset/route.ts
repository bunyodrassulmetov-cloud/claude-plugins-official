import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { parseBody, resetSchema } from '@/lib/validation';
import { consumeResetToken } from '@/lib/password-reset';

/** Установка нового пароля по одноразовой ссылке. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { data, error } = parseBody(resetSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const user = await consumeResetToken(data.token);
    if (!user) return fail('Ссылка недействительна или устарела. Запросите новую.', 400);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(data.newPassword),
        // Обрывает все открытые сессии: если пароль меняют из-за утечки, чужой доступ пропадёт
        passwordChangedAt: new Date(),
      },
    });
    return ok({ success: true });
  });
}
