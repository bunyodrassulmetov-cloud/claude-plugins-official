import type { TaskRowData } from '@/lib/tasks';
import TaskRow from './TaskRow';

export default function TaskSection({
  title,
  hint,
  tasks,
  tone = 'default',
}: {
  title: string;
  hint?: string;
  tasks: TaskRowData[];
  tone?: 'default' | 'danger' | 'success';
}) {
  if (tasks.length === 0) return null;
  const toneClass = {
    default: 'text-slate-700',
    danger: 'text-red-600',
    success: 'text-emerald-600',
  }[tone];

  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${toneClass}`}>{title}</h2>
        <span className="text-xs text-slate-400">{tasks.length}</span>
        {hint ? <span className="text-xs text-slate-400">· {hint}</span> : null}
      </div>
      <ul className="card overflow-hidden">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
    </section>
  );
}
