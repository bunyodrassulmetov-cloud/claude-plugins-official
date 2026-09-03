import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { assignableUserIds, isAdmin, isManager } from '@/lib/permissions';
import { groupTasks, listTasks, toRowData, type TaskFilters as Filters } from '@/lib/tasks';
import TaskFilters from '@/components/TaskFilters';
import TaskSection from '@/components/TaskSection';
import { EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Задачи — Task Manager' };

type SearchParams = Record<string, string | undefined>;

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  if (isAdmin(user)) redirect('/admin/users');

  const params = await searchParams;
  const { timezone } = await getSettings();
  const now = new Date();

  const filters: Filters = {
    view: (params.view as Filters['view']) || undefined,
    status: (params.status as Filters['status']) || undefined,
    priority: (params.priority as Filters['priority']) || undefined,
    assigneeId: params.assigneeId ? Number(params.assigneeId) : undefined,
    departmentId: params.departmentId ? Number(params.departmentId) : undefined,
    from: params.from ? new Date(`${params.from}T00:00:00`) : undefined,
    to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    search: params.search || undefined,
  };

  const tasks = await listTasks(user, filters, 500);
  const { overdue, today, upcoming, done } = groupTasks(tasks, now, timezone);
  const rows = (list: typeof tasks) => list.map((task) => toRowData(task, timezone, now));

  const allowed = await assignableUserIds(user);
  const [people, departments] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { not: 'ADMIN' } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
    isManager(user)
      ? prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ]);

  const assigneeOptions =
    allowed === 'ALL'
      ? people
      : people.filter((p) => allowed.includes(p.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Задачи</h1>
          <p className="text-sm text-slate-500">
            Найдено: {tasks.length}
            {tasks.length === 500 ? ' (показаны первые 500)' : ''}
          </p>
        </div>
        <Link href="/tasks/new" className="btn-primary">
          + Новая задача
        </Link>
      </div>

      <TaskFilters
        showAssignee={isManager(user)}
        assignees={assigneeOptions.map((p) => ({ value: String(p.id), label: p.fullName }))}
        departments={departments.map((d) => ({ value: String(d.id), label: d.name }))}
      />

      <TaskSection title="Просрочено" tasks={rows(overdue)} tone="danger" />
      <TaskSection title="Сегодня" tasks={rows(today)} />
      <TaskSection title="Предстоящие" tasks={rows(upcoming)} />
      <TaskSection title="Закрытые" tasks={rows(done)} tone="success" />

      {tasks.length === 0 ? (
        <EmptyState title="Ничего не найдено" hint="Измените фильтры или сбросьте их." />
      ) : null}
    </div>
  );
}
