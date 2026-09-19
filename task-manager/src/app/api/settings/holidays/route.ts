import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { canManageUsers } from '@/lib/permissions';
import { holidaySchema, parseBody } from '@/lib/validation';

/** Праздники и переносы: влияют на подсчёт просрочки и на вечернюю сводку. */
export async function GET() {
  return handle(async () => {
    await requireUser();
    return ok(await prisma.nonWorkingDay.findMany({ orderBy: { day: 'asc' } }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageUsers(user)) throw new HttpError(403, 'Календарь ведёт администратор');

    const { data, error } = parseBody(holidaySchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const created = await prisma.nonWorkingDay.upsert({
      where: { day: data.day },
      update: { name: data.name },
      create: data,
    });
    return ok(created, 201);
  });
}

export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageUsers(user)) throw new HttpError(403, 'Календарь ведёт администратор');

    const day = request.nextUrl.searchParams.get('day');
    if (!day) return fail('Не указана дата', 422);
    await prisma.nonWorkingDay.deleteMany({ where: { day } });
    return ok({ success: true });
  });
}
