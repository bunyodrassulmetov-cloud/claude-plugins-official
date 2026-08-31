import 'server-only';
import { prisma } from '@/lib/db';
import { OPEN_STATUSES } from '@/lib/tasks';
import { getSettings } from '@/lib/settings';
import { formatDateTime } from '@/lib/dates';
import { notify } from '@/lib/notifications';

/** Напоминание о приближающемся дедлайне — один раз на задачу в пределах окна. */
export async function sendDeadlineReminders(now = new Date()) {
  const { deadlineReminderHours, timezone } = await getSettings();
  const until = new Date(now.getTime() + deadlineReminderHours * 3_600_000);

  const tasks = await prisma.task.findMany({
    where: { deadline: { gte: now, lte: until }, status: { in: OPEN_STATUSES } },
    select: { id: true, title: true, deadline: true, assigneeId: true },
  });
  if (tasks.length === 0) return { sent: 0 };

  const alreadyNotified = await prisma.notification.findMany({
    where: {
      type: 'DEADLINE_SOON',
      taskId: { in: tasks.map((t) => t.id) },
      createdAt: { gte: new Date(now.getTime() - deadlineReminderHours * 3_600_000) },
    },
    select: { taskId: true, userId: true },
  });
  const seen = new Set(alreadyNotified.map((n) => `${n.taskId}:${n.userId}`));

  const payload = tasks
    .filter((task) => !seen.has(`${task.id}:${task.assigneeId}`))
    .map((task) => ({
      userId: task.assigneeId,
      type: 'DEADLINE_SOON' as const,
      taskId: task.id,
      title: 'Приближается дедлайн',
      body: `«${task.title}» — срок ${formatDateTime(task.deadline, timezone)}.`,
    }));

  await notify(payload);
  return { sent: payload.length };
}
