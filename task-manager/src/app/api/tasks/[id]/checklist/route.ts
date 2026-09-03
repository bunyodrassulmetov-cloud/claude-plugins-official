import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { canCommentTask } from '@/lib/permissions';
import { getTaskForUser } from '@/lib/task-actions';
import { logActivity } from '@/lib/tasks';
import { checklistCreateSchema, parseBody } from '@/lib/validation';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const task = await getTaskForUser(user, Number(id));
    if (!(await canCommentTask(user, task))) throw new HttpError(403, 'Нет прав менять чек-лист');

    const { data, error } = parseBody(checklistCreateSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const last = await prisma.checklistItem.findFirst({
      where: { taskId: task.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const item = await prisma.checklistItem.create({
      data: { taskId: task.id, title: data.title, position: (last?.position ?? 0) + 1 },
    });
    await logActivity(task.id, user.id, 'checklist_added', { title: data.title });
    return ok(item, 201);
  });
}
