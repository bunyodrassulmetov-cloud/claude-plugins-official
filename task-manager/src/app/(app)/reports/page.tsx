import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isManager } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { formatDate, formatDateTime } from '@/lib/dates';
import type { ReportTotals, UnfinishedTask } from '@/lib/jobs/reports';
import ReportRefresh from '@/components/ReportRefresh';
import { EmptyState, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Отчёты — Task Manager' };

const PERIODS = [
  { value: 'DAILY', label: 'День' },
  { value: 'WEEKLY', label: 'Неделя' },
  { value: 'MONTHLY', label: 'Месяц' },
] as const;

const PRIORITY_RU: Record<string, string> = {
  LOW: 'низкий',
  MEDIUM: 'средний',
  HIGH: 'высокий',
  CRITICAL: 'критичный',
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; reportId?: string }>;
}) {
  const user = await requireUser();
  if (!isManager(user)) redirect('/dashboard');

  const params = await searchParams;
  const period = (PERIODS.find((p) => p.value === params.period)?.value ?? 'DAILY') as
    | 'DAILY'
    | 'WEEKLY'
    | 'MONTHLY';
  const { timezone } = await getSettings();

  const reports = await prisma.report.findMany({
    where: { recipientId: user.id, periodType: period },
    include: { department: { select: { name: true } } },
    orderBy: { periodStart: 'desc' },
    take: 30,
  });

  const selectedId = params.reportId ? Number(params.reportId) : reports[0]?.id;
  const report = selectedId
    ? await prisma.report.findFirst({
        where: { id: selectedId, recipientId: user.id },
        include: {
          department: { select: { name: true } },
          items: {
            include: { user: { select: { fullName: true, position: true } } },
            orderBy: { overdue: 'desc' },
          },
        },
      })
    : null;

  const totals = (report?.totals ?? null) as ReportTotals | null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Отчёты</h1>
          <p className="text-sm text-slate-500">
            {user.role === 'DIRECTOR'
              ? 'Сводка по всем сотрудникам компании.'
              : `Сводка по отделу${user.departmentName ? ` «${user.departmentName}»` : ''}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            {PERIODS.map((item) => (
              <Link
                key={item.value}
                href={`/reports?period=${item.value}`}
                className={`rounded-md px-3 py-1.5 ${
                  period === item.value ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <ReportRefresh period={period} />
        </div>
      </div>

      {!report || !totals ? (
        <EmptyState
          title="Отчётов за этот период пока нет"
          hint="Сводка формируется автоматически в конце рабочего дня. Можно пересчитать вручную кнопкой выше."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">
              {formatDate(report.periodStart, timezone)} — {formatDate(report.periodEnd, timezone)}
            </span>
            {report.department ? <span>· {report.department.name}</span> : <span>· вся компания</span>}
            <span>· сформирован {formatDateTime(report.generatedAt, timezone)}</span>
            <a className="btn-secondary ml-auto" href={`/api/reports/${report.id}/export`}>
              Выгрузить для Excel
            </a>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Запланировано" value={totals.planned} />
            <StatCard label="Выполнено" value={totals.completed} tone="success" />
            <StatCard label="На приёмке" value={totals.pending} tone="warning" />
            <StatCard label="Просрочено" value={totals.overdue} tone={totals.overdue ? 'danger' : 'default'} />
            <StatCard label="Перенесено" value={totals.carriedOver} hint="с прошлых дней" />
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Сотрудник</th>
                  <th className="px-4 py-3 text-center">Запланировано</th>
                  <th className="px-4 py-3 text-center">Выполнено</th>
                  <th className="px-4 py-3 text-center">На приёмке</th>
                  <th className="px-4 py-3 text-center">Просрочено</th>
                  <th className="px-4 py-3 text-center">Перенесено</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.user.fullName}</p>
                      {item.user.position ? (
                        <p className="text-xs text-slate-400">{item.user.position}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">{item.planned}</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600">{item.completed}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{item.pending}</td>
                    <td className={`px-4 py-3 text-center ${item.overdue ? 'font-semibold text-red-600' : ''}`}>
                      {item.overdue}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">{item.carriedOver}</td>
                  </tr>
                ))}
                {report.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      В отчёте нет сотрудников — проверьте состав отдела.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Невыполненные задачи
            </h2>
            {report.items.every((item) => (item.unfinished as unknown as UnfinishedTask[]).length === 0) ? (
              <EmptyState title="Невыполненных задач нет" />
            ) : (
              report.items.map((item) => {
                const unfinished = item.unfinished as unknown as UnfinishedTask[];
                if (unfinished.length === 0) return null;
                return (
                  <div key={item.id} className="card p-4">
                    <p className="mb-2 font-medium text-slate-800">
                      {item.user.fullName}{' '}
                      <span className="text-sm font-normal text-slate-400">
                        — {unfinished.length} незакрытых
                      </span>
                    </p>
                    <ul className="space-y-2">
                      {unfinished.map((task) => (
                        <li key={task.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                          <Link href={`/tasks/${task.id}`} className="font-medium text-slate-700 hover:underline">
                            {task.title}
                          </Link>
                          <span className={task.overdue ? 'text-red-600' : 'text-slate-500'}>
                            дедлайн {formatDateTime(task.deadline, timezone)}
                            {task.overdue ? ' · просрочено' : ''}
                          </span>
                          <span className="text-xs text-slate-400">
                            приоритет {PRIORITY_RU[task.priority] ?? task.priority} · заказчик {task.customer}
                            {task.acceptor ? ` · принимает ${task.acceptor}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}

      {reports.length > 1 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Архив отчётов</h2>
          <div className="card divide-y divide-slate-100">
            {reports.map((item) => (
              <Link
                key={item.id}
                href={`/reports?period=${period}&reportId=${item.id}`}
                className={`flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 ${
                  item.id === report?.id ? 'bg-slate-50 font-medium' : ''
                }`}
              >
                <span>
                  {formatDate(item.periodStart, timezone)} — {formatDate(item.periodEnd, timezone)}
                </span>
                <span className="text-xs text-slate-400">
                  {item.department?.name ?? 'вся компания'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
