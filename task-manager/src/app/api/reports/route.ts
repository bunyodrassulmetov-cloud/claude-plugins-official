import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';
import { reportScope } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const scope = await reportScope(user);
    if (!scope) throw new HttpError(403, 'Отчёты доступны только руководителям');

    const periodType = request.nextUrl.searchParams.get('period') ?? undefined;
    const reports = await prisma.report.findMany({
      where: {
        ...('all' in scope ? {} : { departmentId: { in: scope.departmentIds } }),
        ...(periodType ? { periodType: periodType as 'DAILY' | 'WEEKLY' | 'MONTHLY' } : {}),
        recipientId: user.id,
      },
      include: {
        department: { select: { id: true, name: true } },
        items: { include: { user: { select: { id: true, fullName: true, position: true } } } },
      },
      orderBy: { periodStart: 'desc' },
      take: 60,
    });
    return ok(reports);
  });
}
