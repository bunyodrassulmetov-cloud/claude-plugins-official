import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSessionCookie, verifyPassword } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { loginSchema, parseBody } from '@/lib/validation';
import { clearFailures, clientIp, lockedForSeconds, registerFailure } from '@/lib/login-throttle';

export async function POST(request: NextRequest) {
  return handle(async () => {
    const { data, error } = parseBody(loginSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const email = data.email.toLowerCase();
    const ip = clientIp(request.headers);

    const locked = await lockedForSeconds(email, ip);
    if (locked) {
      return fail(`Слишком много неудачных попыток. Повторите через ${Math.ceil(locked / 60)} мин.`, 429);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Одинаковый ответ на неверный логин и неверный пароль — не подсказываем, какие email существуют.
    if (!user || !user.isActive || !(await verifyPassword(data.password, user.passwordHash))) {
      await registerFailure(email, ip);
      return fail('Неверный email или пароль', 401);
    }

    // Пароль верный: здесь уже можно сказать, что заявка не обработана
    if (user.approvalStatus === 'PENDING') {
      return fail('Заявка на доступ ещё не подтверждена администратором', 403);
    }
    if (user.approvalStatus === 'REJECTED') {
      return fail('В доступе отказано. Обратитесь к администратору.', 403);
    }

    await clearFailures(email, ip);
    await createSessionCookie(user);
    return ok({ id: user.id, fullName: user.fullName, role: user.role });
  });
}
