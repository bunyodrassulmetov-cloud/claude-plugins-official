import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok, parseId } from '@/lib/api';
import { canManageUsers } from '@/lib/permissions';
import { approvalSchema, parseBody } from '@/lib/validation';
import { notify } from '@/lib/notifications';

/** Подтверждение или отклонение заявки на доступ. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireUser();
    if (!canManageUsers(admin)) throw new HttpError(403, 'Доступ выдаёт администратор');

    const { id } = await params;
    const { data, error } = parseBody(approvalSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const target = await prisma.user.findUnique({ where: { id: parseId(id) } });
    if (!target) throw new HttpError(404, 'Пользователь не найден');
    if (target.approvalStatus !== 'PENDING') throw new HttpError(409, 'Заявка уже обработана');

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: data.approve
        ? {
            approvalStatus: 'APPROVED',
            approvedById: admin.id,
            approvedAt: new Date(),
            isActive: true,
            ...(data.role ? { role: data.role } : {}),
            ...(data.position !== undefined ? { position: data.position } : {}),
            ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
            ...(data.managerId !== undefined ? { managerId: data.managerId || null } : {}),
          }
        : { approvalStatus: 'REJECTED', approvedById: admin.id, approvedAt: new Date(), isActive: false },
      select: { id: true, fullName: true, approvalStatus: true },
    });

    if (data.approve) {
      await notify({
        userId: updated.id,
        type: 'ACCESS_REQUEST',
        title: 'Доступ открыт',
        body: 'Заявка подтверждена — можно входить в систему.',
      });
    }
    return ok(updated);
  });
}
