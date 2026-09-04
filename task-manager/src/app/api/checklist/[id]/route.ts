import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok, parseId } from '@/lib/api';
import { canCommentTask } from '@/lib/permissions';
import { logActivity, taskInclude } from '@/lib/tasks';
import { checklistUpdateSchema, parseBody } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

async function loadItem(id: number) {
  const item = await prisma.checklistItem.findUnique({
    where: { id },
    include: { task: { include: taskInclude } },
  });
  if (!item) throw new HttpError(404, 'Пункт не найден');
  return item;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const item = await loadItem(parseId(id));
    if (!(await canCommentTask(user, item.task))) throw new HttpError(403, 'Нет прав менять чек-лист');

    const { data, error } = parseBody(checklistUpdateSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const updated = await prisma.checklistItem.update({
      where: { id: item.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.isDone !== undefined
          ? {
              isDone: data.isDone,
              doneById: data.isDone ? user.id : null,
              doneAt: data.isDone ? new Date() : null,
            }
          : {}),
      },
    });
    if (data.isDone !== undefined) {
      await logActivity(item.taskId, user.id, 'checklist_toggled', {
        title: item.title,
        isDone: data.isDone,
      });
    }
    return ok(updated);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const item = await loadItem(parseId(id));
    if (!(await canCommentTask(user, item.task))) throw new HttpError(403, 'Нет прав менять чек-лист');
    await prisma.checklistItem.delete({ where: { id: item.id } });
    return ok({ success: true });
  });
}
