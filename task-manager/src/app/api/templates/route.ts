import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { isAdmin, isDirector, isChief, subordinateIds } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { nextOccurrence } from '@/lib/recurrence';
import { parseBody, templateSchema } from '@/lib/validation';

export const templateInclude = {
  assignee: { select: { id: true, fullName: true } },
  customer: { select: { id: true, fullName: true } },
  acceptor: { select: { id: true, fullName: true } },
} as const;

/** Шаблоны видит их автор, исполнитель, а руководитель — по своей зоне. */
export async function visibleTemplatesFilter(user: Awaited<ReturnType<typeof requireUser>>) {
  if (isDirector(user)) return {};
  if (isAdmin(user)) return { id: -1 };
  if (isChief(user)) {
    const ids = [user.id, ...(await subordinateIds(user))];
    return { OR: [{ assigneeId: { in: ids } }, { createdById: { in: ids } }, { customerId: user.id }] };
  }
  return { OR: [{ assigneeId: user.id }, { createdById: user.id }, { customerId: user.id }] };
}

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const templates = await prisma.taskTemplate.findMany({
      where: await visibleTemplatesFilter(user),
      include: templateInclude,
      orderBy: { nextDeadline: 'asc' },
    });
    return ok(templates);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (isAdmin(user)) throw new HttpError(403, 'Администратор не ведёт задачи');

    const { data, error } = parseBody(templateSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const { timezone } = await getSettings();
    const nextDeadline = nextOccurrence(
      {
        recurrence: data.recurrence,
        dayOfWeek: data.dayOfWeek ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        dueHour: data.dueHour,
        dueMinute: data.dueMinute,
      },
      new Date(),
      timezone,
    );

    const template = await prisma.taskTemplate.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        assigneeId: data.assigneeId,
        customerId: data.customerId,
        acceptorId: data.acceptorId ?? null,
        coAssigneeIds: data.coAssigneeIds ?? [],
        createdById: user.id,
        priority: data.priority,
        checklist: data.checklist ?? [],
        recurrence: data.recurrence,
        dayOfWeek: data.dayOfWeek ?? null,
        dayOfMonth: data.dayOfMonth ?? null,
        dueHour: data.dueHour,
        dueMinute: data.dueMinute,
        leadDays: data.leadDays,
        nextDeadline,
      },
      include: templateInclude,
    });
    return ok(template, 201);
  });
}
