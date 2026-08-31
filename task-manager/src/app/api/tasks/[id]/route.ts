import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { canDeleteTask } from '@/lib/permissions';
import { getTaskForUser, updateTask } from '@/lib/task-actions';
import { parseBody, taskUpdateSchema } from '@/lib/validation';
import { deleteStoredFile } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const task = await getTaskForUser(user, Number(id));
    const [notes, attachments, activity] = await Promise.all([
      prisma.taskNote.findMany({
        where: { taskId: task.id },
        include: { author: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.attachment.findMany({
        where: { taskId: task.id },
        include: { uploadedBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.taskActivity.findMany({
        where: { taskId: task.id },
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return ok({ task, notes, attachments, activity });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { data, error } = parseBody(taskUpdateSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);
    return ok(await updateTask(user, Number(id), data));
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const task = await getTaskForUser(user, Number(id));
    if (!(await canDeleteTask(user, task))) {
      throw new HttpError(403, 'Удалять можно только созданные вами задачи; остальные — отменяйте');
    }
    const attachments = await prisma.attachment.findMany({ where: { taskId: task.id } });
    await prisma.task.delete({ where: { id: task.id } });
    await Promise.all(attachments.map((a) => deleteStoredFile(a.storedPath)));
    return ok({ success: true });
  });
}
