import 'server-only';
import { prisma } from '@/lib/db';
import { OPEN_STATUSES } from '@/lib/tasks';
import { dayBounds } from '@/lib/dates';
import { getSettings } from '@/lib/settings';
import { notify } from '@/lib/notifications';

const DAY_MS = 86_400_000;

/**
 * Ежедневный «перенос»: незакрытые задачи с истёкшим дедлайном помечаются
 * просроченными и продолжают показываться в списке текущего дня.
 * Сами задачи не переносятся и не копируются — меняются только флаги.
 */
export async function markOverdueTasks(now = new Date()) {
  const { timezone } = await getSettings();
  const { start: todayStart } = dayBounds(now, timezone);

  const overdueTasks = await prisma.task.findMany({
    where: { deadline: { lt: now }, status: { in: OPEN_STATUSES } },
    select: { id: true, deadline: true, isOverdue: true, overdueSince: true, assigneeId: true, title: true },
  });

  let marked = 0;
  for (const task of overdueTasks) {
    const carryOverDays = Math.max(
      0,
      Math.floor((todayStart.getTime() - dayBounds(task.deadline, timezone).start.getTime()) / DAY_MS),
    );
    await prisma.task.update({
      where: { id: task.id },
      data: {
        isOverdue: true,
        overdueSince: task.overdueSince ?? task.deadline,
        carryOverDays,
      },
    });
    if (!task.isOverdue) {
      marked += 1;
      await notify({
        userId: task.assigneeId,
        type: 'TASK_OVERDUE',
        taskId: task.id,
        title: 'Задача просрочена',
        body: `«${task.title}» перенесена в список текущего дня как просроченная.`,
      });
    }
  }

  // Снимаем флаг с задач, у которых дедлайн перенесли вперёд или которые закрыли.
  const cleared = await prisma.task.updateMany({
    where: {
      isOverdue: true,
      OR: [{ deadline: { gte: now } }, { status: { in: ['DONE', 'CANCELLED'] } }],
    },
    data: { isOverdue: false, overdueSince: null, carryOverDays: 0 },
  });

  return { scanned: overdueTasks.length, newlyOverdue: marked, cleared: cleared.count };
}
