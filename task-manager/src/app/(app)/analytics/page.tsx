import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { isDirector, isManager } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { loadAnalytics } from '@/lib/analytics';
import WeeklyColumns from '@/components/charts/WeeklyColumns';
import PeopleBars from '@/components/charts/PeopleBars';
import { EmptyState, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Аналитика — Task Manager' };

const RANGES = [
  { weeks: 8, label: '8 недель' },
  { weeks: 13, label: 'Квартал' },
  { weeks: 26, label: 'Полгода' },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ weeks?: string }>;
}) {
  const user = await requireUser();
  if (!isManager(user)) redirect('/reports');

  const params = await searchParams;
  const weeks = RANGES.find((range) => String(range.weeks) === params.weeks)?.weeks ?? 8;
  const { timezone } = await getSettings();
  const data = await loadAnalytics(user, weeks, timezone);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Аналитика</h1>
          <p className="text-sm text-slate-500">
            {isDirector(user) ? 'По всей компании' : `По отделу${user.departmentName ? ` «${user.departmentName}»` : ''}`}
            : выполнено в срок и с опозданием.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          {RANGES.map((range) => (
            <Link
              key={range.weeks}
              href={`/analytics?weeks=${range.weeks}`}
              className={`rounded-md px-3 py-1.5 ${
                weeks === range.weeks ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              {range.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Выполнено" value={data.totals.completed} hint="за период" />
        <StatCard
          label="Доля в срок"
          value={`${data.totals.onTimeShare}%`}
          tone={data.totals.onTimeShare >= 80 ? 'success' : data.totals.onTimeShare >= 60 ? 'warning' : 'danger'}
        />
        <StatCard label="С опозданием" value={data.totals.late} tone={data.totals.late ? 'warning' : 'default'} />
        <StatCard
          label="Просрочено сейчас"
          value={data.totals.openOverdue}
          tone={data.totals.openOverdue ? 'danger' : 'default'}
          hint="открытых задач"
        />
      </div>

      {data.totals.completed === 0 && data.people.length === 0 ? (
        <EmptyState title="Данных пока нет" hint="Статистика появится, когда задачи начнут закрываться." />
      ) : (
        <>
          <section className="card space-y-2 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Ритм закрытия задач по неделям
            </h2>
            <WeeklyColumns weeks={data.weeks} />
          </section>

          <section className="card space-y-2 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">По сотрудникам</h2>
            <p className="text-xs text-slate-400">
              Сверху те, у кого больше опозданий и открытых просрочек.
            </p>
            <div className="overflow-x-auto">
              <PeopleBars people={data.people} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
