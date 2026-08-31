import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSessionCookie, verifyPassword } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { loginSchema, parseBody } from '@/lib/validation';

export async function POST(request: NextRequest) {
  return handle(async () => {
    const { data, error } = parseBody(loginSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    // Одинаковый ответ на неверный логин и неверный пароль — не подсказываем, какие email существуют.
    if (!user || !user.isActive || !(await verifyPassword(data.password, user.passwordHash))) {
      return fail('Неверный email или пароль', 401);
    }

    await createSessionCookie(user);
    return ok({ id: user.id, fullName: user.fullName, role: user.role });
  });
}
