import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { parseBody, registerSchema } from '@/lib/validation';
import { notify } from '@/lib/notifications';
import { clientIp, lockedForSeconds, registerFailure } from '@/lib/login-throttle';

/**
 * Самостоятельная регистрация. Учётная запись создаётся, но до подтверждения
 * администратором войти нельзя — доступ к задачам компании выдаёт человек, а не форма.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const { data, error } = parseBody(registerSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const ip = clientIp(request.headers);
    // Тот же счётчик, что и у входа: форма регистрации не должна становиться
    // способом перебирать существующие адреса
    const locked = await lockedForSeconds('register', ip);
    if (locked) return fail('Слишком много попыток. Повторите позже.', 429);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      await registerFailure('register', ip);
      return fail('Пользователь с таким email уже зарегистрирован', 409);
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        passwordHash: await hashPassword(data.password),
        role: 'ACCOUNTANT',
        approvalStatus: 'PENDING',
        signupNote: data.note ?? null,
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true, approvalStatus: 'APPROVED' },
      select: { id: true },
    });
    await notify(
      admins.map((admin) => ({
        userId: admin.id,
        type: 'ACCESS_REQUEST' as const,
        title: 'Заявка на доступ',
        body:
          `${user.fullName} (${user.email}) просит доступ.` +
          (data.note ? ` О себе: ${data.note}` : '') +
          ' Подтвердить — раздел «Сотрудники».',
      })),
    );

    return ok({ pending: true }, 201);
  });
}
