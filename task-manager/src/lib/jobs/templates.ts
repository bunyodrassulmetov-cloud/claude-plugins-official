import 'server-only';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { nextOccurrence } from '@/lib/recurrence';
import { notify } from '@/lib/notifications';
import { formatDateTime } from '@/lib/dates';

/**
 * Создаёт задачи из повторяющихся шаблонов.
 * Опорная точка — nextDeadline у шаблона: он сдвигается вперёд сразу после создания
 * задачи, поэтому повторный запуск джоба ничего не задваивает. Если планировщик
 * простоял несколько дней, цикл догонит пропущенные сроки (не более 12 за раз).
 */
export async function runTaskTemplates(now = new Date()) {
  const { timezone } = await getSettings();
  const templates = await prisma.taskTemplate.findMany({ where: { isActive: true } });

  let created = 0;
  for (const template of templates) {
    let deadline = template.nextDeadline;
    let lastCreated: Date | null = null;

    for (let guard = 0; guard < 12; guard += 1) {
      const openFrom = deadline.getTime() - template.leadDays * 86_400_000;
      if (openFrom > now.getTime()) break;

      const assignee = await prisma.user.findUnique({
        where: { id: template.assigneeId },
        select: { departmentId: true, isActive: true, fullName: true },
      });
      if (!assignee?.isActive) break; // исполнителя отключили — шаблон ждёт правки

      const task = await prisma.task.create({
        data: {
          title: template.title,
          description: template.description,
          assigneeId: template.assigneeId,
          customerId: template.customerId,
          acceptorId: template.acceptorId,
          createdById: template.createdById,
          departmentId: assignee.departmentId,
          priority: template.priority,
          deadline,
          isOverdue: deadline < now,
          overdueSince: deadline < now ? deadline : null,
          coAssignees: {
            create: template.coAssigneeIds
              .filter((id) => id !== template.assigneeId)
              .map((userId) => ({ userId })),
          },
          checklist: {
            create: template.checklist.map((title, index) => ({ title, position: index + 1 })),
          },
        },
      });

      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: template.createdById,
          action: 'created',
          details: { fromTemplate: template.id },
        },
      });
      await notify({
        userId: template.assigneeId,
        type: 'TASK_ASSIGNED',
        taskId: task.id,
        title: 'Повторяющаяся задача',
        body: `«${template.title}» — срок ${formatDateTime(deadline, timezone)}.`,
      });

      created += 1;
      lastCreated = new Date();
      deadline = nextOccurrence(template, deadline, timezone);
    }

    if (lastCreated) {
      await prisma.taskTemplate.update({
        where: { id: template.id },
        data: { nextDeadline: deadline, lastCreatedAt: lastCreated },
      });
    }
  }

  return { templates: templates.length, created };
}
