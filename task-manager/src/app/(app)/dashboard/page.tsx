import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { isAdmin, isManager } from '@/lib/permissions';
import { groupTasks, listTasks, taskInclude, withRowAbilities } from '@/lib/tasks';
import TaskSection from '@/components/TaskSection';
import { EmptyState, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Мой день — Task Manager' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const user = await requireUser();
  if (isAdmin(user)) redirect('/admin/users');

  const { scope } = await searchParams;
  const teamView = scope === 'team' && isManager(user);
  const { timezone } = await getSettings();
  const now = new Date();

  const tasks = await listTasks(user, { view: 'today', onlyMine: !teamView });
  const groups = groupTasks(tasks, now, timezone);
  const rows = (list: typeof tasks) => withRowAbilities(user, list, timezone, now);
  const { overdue, today, upcoming } = groups;
  const done = groups.done;

  // Задачи, ждущие приёмки лично от текущего пользователя.
  const awaitingMyAcceptance = await prisma.task.findMany({
    where: { status: 'PENDING_ACCEPTANCE', OR: [{ acceptorId: user.id }, { acceptorId: null, customerId: user.id }] },
    include: taskInclude,
    orderBy: { submittedAt: 'asc' },
  });

  const doneToday = done.filter(
    (t) => t.completedAt && t.completedAt >= new Date(now.getTime() - 86_400_000),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Мой день</h1>
          <p className="text-sm text-slate-500">
            Задачи с дедлайном на сегодня и все незакрытые хвосты прошлых дней.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager(user) ? (
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
              <Link
                href="/dashboard"
                className={`rounded-md px-3 py-1.5 ${!teamView ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
              >
                Мои
              </Link>
              <Link
                href="/dashboard?scope=team"
                className={`rounded-md px-3 py-1.5 ${teamView ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
              >
                {user.role === 'DIRECTOR' ? 'Вся компания' : 'Отдел'}
              </Link>
            </div>
          ) : null}
          <Link href="/tasks/new" className="btn-primary">
            + Новая задача
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="На сегодня" value={today.length} />
        <StatCard label="Просрочено" value={overdue.length} tone={overdue.length ? 'danger' : 'default'} />
        <StatCard label="Ждут приёмки" value={awaitingMyAcceptance.length} tone="warning" hint="от вас" />
        <StatCard label="Выполнено" value={doneToday.length} tone="success" hint="за сутки" />
      </div>

      {awaitingMyAcceptance.length > 0 ? (
        <TaskSection
          title="Ждут вашей приёмки"
          hint="исполнитель отчитался о выполнении"
          tasks={await rows(awaitingMyAcceptance)}
          tone="default"
        />
      ) : null}

      <TaskSection
        title="Просрочено"
        hint="перенесено с прошлых дней"
        tasks={await rows(overdue)}
        tone="danger"
      />
      <TaskSection title="На сегодня" tasks={await rows(today)} />
      <TaskSection title="Ближайшие" tasks={await rows(upcoming)} />
      <TaskSection title="Выполнено" tasks={await rows(done)} tone="success" />

      {tasks.length === 0 && awaitingMyAcceptance.length === 0 ? (
        <EmptyState
          title="На сегодня задач нет"
          hint="Поставьте задачу себе или дождитесь поручения от руководителя."
        />
      ) : null}
    </div>
  );
}
