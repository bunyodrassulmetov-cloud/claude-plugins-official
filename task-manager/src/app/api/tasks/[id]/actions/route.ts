import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { applyTaskAction } from '@/lib/task-actions';
import { parseBody, taskActionSchema } from '@/lib/validation';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const { data, error } = parseBody(taskActionSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректное действие', 422);
    return ok(await applyTaskAction(user, Number(id), data.action, data.comment));
  });
}
