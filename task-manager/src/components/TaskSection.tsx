import type { TaskWithRelations } from '@/lib/tasks';
import TaskCard from './TaskCard';

export default function TaskSection({
  title,
  hint,
  tasks,
  timezone,
  now,
  tone = 'default',
}: {
  title: string;
  hint?: string;
  tasks: TaskWithRelations[];
  timezone: string;
  now?: Date;
  tone?: 'default' | 'danger' | 'success';
}) {
  if (tasks.length === 0) return null;
  const toneClass = {
    default: 'text-slate-700',
    danger: 'text-red-600',
    success: 'text-emerald-600',
  }[tone];

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${toneClass}`}>{title}</h2>
        <span className="text-xs text-slate-400">{tasks.length}</span>
        {hint ? <span className="text-xs text-slate-400">· {hint}</span> : null}
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} timezone={timezone} now={now} />
        ))}
      </div>
    </section>
  );
}
