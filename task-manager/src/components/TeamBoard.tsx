import type { TaskRowData } from '@/lib/tasks';
import TaskRow from './TaskRow';
import { EmptyState } from './ui';

export type TeamGroup = {
  userId: number;
  fullName: string;
  position: string | null;
  department: string | null;
  unfinished: TaskRowData[];
  done: TaskRowData[];
  overdueCount: number;
};

/**
 * Доска руководителя: сотрудники по алфавиту, под каждым — его незакрытые задачи
 * и то, что он закрыл за сегодня и вчера. Так видно и текущую нагрузку, и результат.
 */
export default function TeamBoard({ groups }: { groups: TeamGroup[] }) {
  if (groups.length === 0) {
    return <EmptyState title="Сотрудников нет" hint="Добавьте людей в разделе «Сотрудники»." />;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.userId} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              {group.fullName}
              {group.position ? (
                <span className="ml-2 text-sm font-normal text-slate-400">{group.position}</span>
              ) : null}
            </h2>
            <div className="flex gap-3 text-xs">
              <span className="text-slate-500">в работе: {group.unfinished.length}</span>
              {group.overdueCount > 0 ? (
                <span className="font-medium text-red-600">просрочено: {group.overdueCount}</span>
              ) : null}
              <span className="text-emerald-600">выполнено: {group.done.length}</span>
            </div>
          </div>

          {group.unfinished.length === 0 && group.done.length === 0 ? (
            <p className="card px-4 py-3 text-sm text-slate-400">Задач нет.</p>
          ) : null}

          {group.unfinished.length > 0 ? (
            <ul className="card overflow-hidden">
              {group.unfinished.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          ) : null}

          {group.done.length > 0 ? (
            <div className="space-y-1">
              <p className="px-1 text-xs uppercase tracking-wide text-slate-400">
                Выполнено за сегодня и вчера
              </p>
              <ul className="card overflow-hidden">
                {group.done.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
