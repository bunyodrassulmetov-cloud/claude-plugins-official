import Link from 'next/link';
import type { TaskWithRelations } from '@/lib/tasks';
import { isTaskOverdue } from '@/lib/tasks';
import { formatDateTime, humanizeDeadline } from '@/lib/dates';
import { PRIORITY_BAR, PriorityBadge, StatusBadge } from './ui';

export default function TaskCard({
  task,
  timezone,
  now = new Date(),
}: {
  task: TaskWithRelations;
  timezone: string;
  now?: Date;
}) {
  const closed = task.status === 'DONE' || task.status === 'CANCELLED';
  const overdue = isTaskOverdue(task, now);

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={`card flex gap-0 overflow-hidden transition hover:shadow-md ${closed ? 'opacity-70' : ''}`}
    >
      <span className={`w-1.5 shrink-0 ${closed ? 'bg-slate-200' : PRIORITY_BAR[task.priority]}`} aria-hidden />
      <div className="flex-1 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3
            className={`text-sm font-semibold sm:text-base ${
              closed ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-900'
            }`}
          >
            {task.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} overdue={overdue} />
          </div>
        </div>

        {task.description ? (
          <p className={`mt-1 line-clamp-2 text-sm ${closed ? 'text-slate-400' : 'text-slate-600'}`}>
            {task.description}
          </p>
        ) : null}

        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
          <div className="flex gap-1">
            <dt className="text-slate-400">Исполнитель:</dt>
            <dd className="font-medium text-slate-600">{task.assignee.fullName}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-slate-400">Заказчик:</dt>
            <dd className="font-medium text-slate-600">{task.customer.fullName}</dd>
          </div>
          {task.acceptor ? (
            <div className="flex gap-1">
              <dt className="text-slate-400">Принимает:</dt>
              <dd className="font-medium text-slate-600">{task.acceptor.fullName}</dd>
            </div>
          ) : null}
          <div className="flex gap-1">
            <dt className="text-slate-400">Дедлайн:</dt>
            <dd className={`font-medium ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
              {formatDateTime(task.deadline, timezone)}
              {!closed ? ` · ${humanizeDeadline(task.deadline, now)}` : ''}
            </dd>
          </div>
        </dl>

        {(task._count.attachments > 0 || task._count.notes > 0 || task.carryOverDays > 0) && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
            {task._count.attachments > 0 ? <span>📎 {task._count.attachments}</span> : null}
            {task._count.notes > 0 ? <span>📝 {task._count.notes}</span> : null}
            {task.carryOverDays > 0 && !closed ? (
              <span className="text-red-500">переносится {task.carryOverDays} дн.</span>
            ) : null}
          </div>
        )}
      </div>
    </Link>
  );
}
