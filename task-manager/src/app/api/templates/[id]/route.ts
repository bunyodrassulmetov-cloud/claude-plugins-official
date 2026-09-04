import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok, parseId } from '@/lib/api';
import { isChief, isDirector, subordinateIds } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { nextOccurrence } from '@/lib/recurrence';
import { parseBody, templateSchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

async function loadEditable(userPromise: ReturnType<typeof requireUser>, id: number) {
  const user = await userPromise;
  const template = await prisma.taskTemplate.findUnique({ where: { id } });
  if (!template) throw new HttpError(404, 'Шаблон не найден');

  const own = template.createdById === user.id || template.assigneeId === user.id;
  const inScope = isChief(user) && (await subordinateIds(user)).includes(template.assigneeId);
  if (!own && !inScope && !isDirector(user)) throw new HttpError(403, 'Нет прав на этот шаблон');
  return { user, template };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const { template } = await loadEditable(requireUser(), parseId(id));

    const { data, error } = parseBody(templateSchema.partial(), await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    // Расписание изменилось — пересчитываем ближайший срок
    const scheduleChanged =
      data.recurrence !== undefined ||
      data.dayOfWeek !== undefined ||
      data.dayOfMonth !== undefined ||
      data.dueHour !== undefined ||
      data.dueMinute !== undefined;

    const rule = {
      recurrence: data.recurrence ?? template.recurrence,
      dayOfWeek: data.dayOfWeek ?? template.dayOfWeek,
      dayOfMonth: data.dayOfMonth ?? template.dayOfMonth,
      dueHour: data.dueHour ?? template.dueHour,
      dueMinute: data.dueMinute ?? template.dueMinute,
    };
    const { timezone } = await getSettings();

    const updated = await prisma.taskTemplate.update({
      where: { id: template.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.customerId !== undefined ? { customerId: data.customerId } : {}),
        ...(data.acceptorId !== undefined ? { acceptorId: data.acceptorId || null } : {}),
        ...(data.coAssigneeIds !== undefined ? { coAssigneeIds: data.coAssigneeIds } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.checklist !== undefined ? { checklist: data.checklist } : {}),
        ...(data.leadDays !== undefined ? { leadDays: data.leadDays } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(scheduleChanged
          ? { ...rule, nextDeadline: nextOccurrence(rule, new Date(), timezone) }
          : {}),
      },
    });
    return ok(updated);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const { template } = await loadEditable(requireUser(), parseId(id));
    // Уже созданные задачи остаются: удаляется только правило повторения
    await prisma.taskTemplate.delete({ where: { id: template.id } });
    return ok({ success: true });
  });
}
