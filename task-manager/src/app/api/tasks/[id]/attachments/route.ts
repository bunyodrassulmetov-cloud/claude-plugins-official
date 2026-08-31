import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';
import { canCommentTask } from '@/lib/permissions';
import { getTaskForUser } from '@/lib/task-actions';
import { logActivity } from '@/lib/tasks';
import { saveUpload } from '@/lib/storage';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const task = await getTaskForUser(user, Number(id));
    if (!(await canCommentTask(user, task))) throw new HttpError(403, 'Нет прав прикреплять файлы');

    const form = await request.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new HttpError(400, 'Файлы не переданы');

    const saved = [];
    for (const file of files) {
      const meta = await saveUpload(task.id, file);
      saved.push(
        await prisma.attachment.create({
          data: { taskId: task.id, uploadedById: user.id, ...meta },
          include: { uploadedBy: { select: { id: true, fullName: true } } },
        }),
      );
    }
    await logActivity(task.id, user.id, 'attachment_added', { count: saved.length });
    return ok(saved, 201);
  });
}
