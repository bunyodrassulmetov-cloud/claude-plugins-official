import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';
import { isChief, isDirector, subordinateIds } from '@/lib/permissions';
import { persistReport } from '@/lib/jobs/reports';
import { periodBounds } from '@/lib/dates';
import { getSettings } from '@/lib/settings';

/** Пересобрать отчёт вручную (кнопка «Обновить» в разделе «Отчёты»). */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!isDirector(user) && !isChief(user)) throw new HttpError(403, 'Отчёты доступны только руководителям');

    const body = (await request.json().catch(() => ({}))) as {
      period?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      date?: string;
    };
    const periodType = body.period ?? 'DAILY';
    const reference = body.date ? new Date(body.date) : new Date();
    const { timezone } = await getSettings();
    const { start, end } = periodBounds(periodType, reference, timezone);

    let userIds: number[];
    let departmentId: number | null = null;
    if (isDirector(user)) {
      const staff = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['CHIEF_ACCOUNTANT', 'ACCOUNTANT'] } },
        select: { id: true },
      });
      userIds = staff.map((u) => u.id);
    } else {
      userIds = await subordinateIds(user);
      departmentId = user.departmentId;
    }

    const report = await persistReport({
      periodType,
      periodStart: start,
      periodEnd: end,
      departmentId,
      recipientId: user.id,
      userIds,
    });
    return ok(report, 201);
  });
}
