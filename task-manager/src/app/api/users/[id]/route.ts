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

/**
 * По умолчанию учётная запись отключается: на сотрудника ссылаются задачи и история.
 * ?mode=delete удаляет запись насовсем — но только если следов работы не осталось,
 * иначе задачи лишились бы исполнителя и заказчика.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageUsers(user)) throw new HttpError(403, 'Недостаточно прав');

    const { id } = await params;
    const targetId = parseId(id);
    if (targetId === user.id) throw new HttpError(400, 'Нельзя удалить собственную учётную запись');

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new HttpError(404, 'Пользователь не найден');

    if (request.nextUrl.searchParams.get('mode') !== 'delete') {
      await prisma.user.update({ where: { id: targetId }, data: { isActive: false } });
      return ok({ success: true, mode: 'disabled' });
    }

    if (target.role === 'ADMIN') {
      const admins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (admins <= 1) throw new HttpError(409, 'Это последний администратор — удалять некому будет');
    }

    const [assigned, ordered, created, accepted, notes, templates] = await Promise.all([
      prisma.task.count({ where: { assigneeId: targetId } }),
      prisma.task.count({ where: { customerId: targetId } }),
      prisma.task.count({ where: { createdById: targetId } }),
      prisma.task.count({ where: { acceptorId: targetId } }),
      prisma.taskNote.count({ where: { authorId: targetId } }),
      prisma.taskTemplate.count({ where: { assigneeId: targetId } }),
    ]);
    const links = assigned + ordered + created + accepted + notes + templates;

    if (links > 0) {
      const parts = [
        assigned && `задач как исполнитель: ${assigned}`,
        ordered && `как заказчик: ${ordered}`,
        created && `создано задач: ${created}`,
        accepted && `принимает: ${accepted}`,
        notes && `заметок: ${notes}`,
        templates && `шаблонов: ${templates}`,
      ].filter(Boolean);
      throw new HttpError(
        409,
        `С сотрудником связана работа (${parts.join(', ')}). ` +
          'Удаление стёрло бы историю задач — отключите учётную запись вместо удаления.',
      );
    }

    await prisma.user.delete({ where: { id: targetId } });
    return ok({ success: true, mode: 'deleted' });
  });
}
