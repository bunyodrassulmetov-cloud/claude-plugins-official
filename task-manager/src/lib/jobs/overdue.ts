import 'server-only';
import { prisma } from '@/lib/db';
import { OPEN_STATUSES } from '@/lib/tasks';
import { dayBounds } from '@/lib/dates';
import { getSettings, getWorkingCalendar } from '@/lib/settings';
import { workingDaysBetween } from '@/lib/calendar';
import { notify } from '@/lib/notifications';

/**
 * Ежедневный «перенос»: незакрытые задачи с истёкшим дедлайном помечаются
 * просроченными и продолжают показываться в списке текущего дня.
 * Сами задачи не переносятся и не копируются — меняются только флаги.
 */
export async function markOverdueTasks(now = new Date()) {
  const { timezone } = await getSettings();
  const calendar = await getWorkingCalendar();
  const { start: todayStart } = dayBounds(now, timezone);

  const overdueTasks = await prisma.task.findMany({
    where: { deadline: { lt: now }, status: { in: OPEN_STATUSES } },
    select: { id: true, deadline: true, isOverdue: true, overdueSince: true, assigneeId: true, title: true },
  });

  let marked = 0;
  for (const task of overdueTasks) {
    // Считаем в рабочих днях: иначе задача со сроком в пятницу к понедельнику
    // выглядит просроченной на три дня, хотя прошёл один рабочий
    const carryOverDays = workingDaysBetween(
      dayBounds(task.deadline, timezone).start,
      todayStart,
      calendar,
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
