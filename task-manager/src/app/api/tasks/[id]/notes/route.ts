import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok, parseId } from '@/lib/api';
import { canCommentTask } from '@/lib/permissions';
import { getTaskForUser } from '@/lib/task-actions';
import { logActivity } from '@/lib/tasks';
import { noteSchema, parseBody } from '@/lib/validation';
import { notify } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const task = await getTaskForUser(user, parseId(id));
    if (!(await canCommentTask(user, task))) throw new HttpError(403, 'Нет прав добавлять заметки');

    const { data, error } = parseBody(noteSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const note = await prisma.taskNote.create({
      data: { taskId: task.id, authorId: user.id, body: data.body },
      include: { author: { select: { id: true, fullName: true } } },
    });
    await logActivity(task.id, user.id, 'note_added');
    await notify(
      [task.assigneeId, task.acceptorId, task.customerId]
        .filter((uid): uid is number => typeof uid === 'number')
        .map((userId) => ({
          userId,
          type: 'TASK_UPDATED' as const,
          taskId: task.id,
          title: 'Новая заметка к задаче',
          body: `«${task.title}»: ${data.body.slice(0, 120)}`,
        })),
      user.id,
    );
    return ok(note, 201);
  });
}
