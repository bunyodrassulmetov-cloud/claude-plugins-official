import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSessionCookie, hashPassword, requireUser, verifyPassword } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { parseBody, passwordChangeSchema } from '@/lib/validation';

/** Смена собственного пароля: нужна, чтобы уйти от общего пароля, выданного при заведении учётки. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const { data, error } = parseBody(passwordChangeSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
    if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
      return fail('Текущий пароль указан неверно', 401);
    }
    if (data.currentPassword === data.newPassword) {
      return fail('Новый пароль совпадает со старым', 422);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(data.newPassword) },
    });
    // Выдаём свежий токен, чтобы текущая вкладка не осталась со старой сессией
    await createSessionCookie({ ...user, role: user.role });
    return ok({ success: true });
  });
}
