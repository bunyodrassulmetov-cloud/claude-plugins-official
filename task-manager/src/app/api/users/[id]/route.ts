import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, hashPassword, requireUser } from '@/lib/auth';
import { fail, handle, ok, parseId } from '@/lib/api';
import { canManageUsers } from '@/lib/permissions';
import { parseBody, userUpdateSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageUsers(user)) throw new HttpError(403, 'Недостаточно прав');
    const { id } = await params;

    const { data, error } = parseBody(userUpdateSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const updated = await prisma.user.update({
      where: { id: parseId(id) },
      data: {
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
        ...(data.managerId !== undefined ? { managerId: data.managerId || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        // Сброс пароля администратором тоже обрывает старые сессии сотрудника
        ...(data.password
          ? { passwordHash: await hashPassword(data.password), passwordChangedAt: new Date() }
          : {}),
      },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
    return ok(updated);
  });
}

/** Пользователей не удаляем: на них ссылаются задачи и история. Только деактивация. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageUsers(user)) throw new HttpError(403, 'Недостаточно прав');
    const { id } = await params;
    if (parseId(id) === user.id) throw new HttpError(400, 'Нельзя отключить собственную учётную запись');
    await prisma.user.update({ where: { id: parseId(id) }, data: { isActive: false } });
    return ok({ success: true });
  });
}
