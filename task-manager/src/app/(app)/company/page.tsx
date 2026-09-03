import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { canManageDepartments, isAdmin, isManager } from '@/lib/permissions';
import { OPEN_STATUSES } from '@/lib/tasks';
import DepartmentCreate from '@/components/DepartmentCreate';
import { StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Компания — Task Manager' };

/**
 * Общая страница компании: отделы, их состав и нагрузка.
 * Видна всем сотрудникам — по ней понятно, кому можно поставить задачу.
 * Цифры агрегированные: содержимое чужих задач по-прежнему закрыто.
 */
export default async function CompanyPage() {
  const user = await requireUser();
  const now = new Date();

  const departments = await prisma.department.findMany({
    include: {
      head: { select: { id: true, fullName: true, position: true } },
      members: {
        where: { isActive: true },
        select: { id: true, fullName: true, position: true, role: true },
        orderBy: { fullName: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const [openTasks, overdueTasks, unassigned] = await Promise.all([
    prisma.task.groupBy({
      by: ['departmentId'],
      where: { status: { in: OPEN_STATUSES } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['departmentId'],
      where: { status: { in: OPEN_STATUSES }, deadline: { lt: now } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, departmentId: null, role: { not: 'ADMIN' } },
      select: { id: true, fullName: true, position: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  const openBy = new Map(openTasks.map((row) => [row.departmentId, row._count._all]));
  const overdueBy = new Map(overdueTasks.map((row) => [row.departmentId, row._count._all]));
  const totalOpen = openTasks.reduce((sum, row) => sum + row._count._all, 0);
  const totalOverdue = overdueTasks.reduce((sum, row) => sum + row._count._all, 0);
  const totalPeople = departments.reduce((sum, d) => sum + d.members.length, 0) + unassigned.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Компания</h1>
          <p className="text-sm text-slate-500">
            Отделы и сотрудники. Задачу можно поставить любому — в том числе в соседний отдел.
          </p>
        </div>
        {!isAdmin(user) ? (
          <Link href="/tasks/new" className="btn-primary">
            + Новая задача
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Отделов" value={departments.length} />
        <StatCard label="Сотрудников" value={totalPeople} />
        <StatCard label="Задач в работе" value={totalOpen} />
        <StatCard label="Просрочено" value={totalOverdue} tone={totalOverdue ? 'danger' : 'default'} />
      </div>

      {canManageDepartments(user) ? <DepartmentCreate /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {departments.map((department) => {
          const open = openBy.get(department.id) ?? 0;
          const overdue = overdueBy.get(department.id) ?? 0;
          return (
            <section key={department.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">{department.name}</h2>
                <div className="flex gap-3 text-xs">
                  <span className="text-slate-500">в работе: {open}</span>
                  <span className={overdue ? 'font-medium text-red-600' : 'text-slate-400'}>
                    просрочено: {overdue}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-500">
                Руководитель:{' '}
                <span className="font-medium text-slate-700">
                  {department.head?.fullName ?? 'не назначен'}
                </span>
                {!department.head ? (
                  <span className="ml-1 text-xs text-amber-600">— сводка по отделу не формируется</span>
                ) : null}
              </p>

              <ul className="space-y-1 text-sm">
                {department.members.map((member) => (
                  <li key={member.id} className="flex items-baseline justify-between gap-2">
                    <span className="text-slate-700">{member.fullName}</span>
                    <span className="text-xs text-slate-400">{member.position ?? ''}</span>
                  </li>
                ))}
                {department.members.length === 0 ? (
                  <li className="text-sm text-slate-400">Сотрудников нет.</li>
                ) : null}
              </ul>

              {isManager(user) ? (
                <Link
                  href={`/tasks?departmentId=${department.id}`}
                  className="inline-block text-sm text-slate-500 hover:underline"
                >
                  Задачи отдела →
                </Link>
              ) : null}
            </section>
          );
        })}
      </div>

      {unassigned.length > 0 ? (
        <section className="card space-y-2 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Без отдела</h2>
          <ul className="text-sm text-slate-600">
            {unassigned.map((person) => (
              <li key={person.id}>
                {person.fullName}
                {person.position ? ` — ${person.position}` : ''}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400">
            Их задачи не попадают ни в одну сводку по отделу. Назначьте отдел в разделе «Сотрудники».
          </p>
        </section>
      ) : null}
    </div>
  );
}
