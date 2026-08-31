import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { listTasks, type TaskFilters } from '@/lib/tasks';
import { createTask } from '@/lib/task-actions';
import { parseBody, taskCreateSchema } from '@/lib/validation';

function readFilters(request: NextRequest): TaskFilters {
  const p = request.nextUrl.searchParams;
  const num = (key: string) => (p.get(key) ? Number(p.get(key)) : undefined);
  const date = (key: string) => (p.get(key) ? new Date(p.get(key)!) : undefined);
  return {
    view: (p.get('view') as TaskFilters['view']) ?? undefined,
    status: (p.get('status') as TaskFilters['status']) ?? undefined,
    priority: (p.get('priority') as TaskFilters['priority']) ?? undefined,
    assigneeId: num('assigneeId'),
    departmentId: num('departmentId'),
    from: date('from'),
    to: date('to'),
    search: p.get('search')?.trim() || undefined,
    onlyMine: p.get('onlyMine') === '1',
  };
}

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    return ok(await listTasks(user, readFilters(request)));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const { data, error } = parseBody(taskCreateSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);
    return ok(await createTask(user, data), 201);
  });
}
