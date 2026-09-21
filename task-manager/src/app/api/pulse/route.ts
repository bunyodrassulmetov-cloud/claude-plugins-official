import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Лёгкая проверка «что-то изменилось»: непрочитанные уведомления и момент
 * последнего изменения задач, которые касаются этого человека.
 * По ней интерфейс сам обновляется, не заставляя перезагружать страницу.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();

    const [unread, latest] = await Promise.all([
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
      prisma.task.findFirst({
        where: {
          OR: [
            { assigneeId: user.id },
            { customerId: user.id },
            { acceptorId: user.id },
            { coAssignees: { some: { userId: user.id } } },
          ],
        },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return ok({ unread, tasksUpdatedAt: latest?.updatedAt?.toISOString() ?? null });
  });
}
