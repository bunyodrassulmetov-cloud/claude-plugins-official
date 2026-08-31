import type { Priority, TaskStatus } from '@prisma/client';

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  CRITICAL: 'Критичный',
};

const PRIORITY_CLASSES: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
  MEDIUM: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
};

export const PRIORITY_BAR: Record<Priority, string> = {
  LOW: 'bg-slate-300',
  MEDIUM: 'bg-sky-400',
  HIGH: 'bg-orange-400',
  CRITICAL: 'bg-red-500',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  IN_PROGRESS: 'В работе',
  PENDING_ACCEPTANCE: 'На приёмке',
  DONE: 'Выполнено',
  CANCELLED: 'Отменена',
};

const STATUS_CLASSES: Record<TaskStatus, string> = {
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  PENDING_ACCEPTANCE: 'bg-amber-50 text-amber-700',
  DONE: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge ${PRIORITY_CLASSES[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function StatusBadge({ status, overdue }: { status: TaskStatus; overdue?: boolean }) {
  if (overdue && (status === 'IN_PROGRESS' || status === 'PENDING_ACCEPTANCE')) {
    return <span className="badge bg-red-100 text-red-700">Просрочено</span>;
  }
  return <span className={`badge ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function StatCard({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'danger' | 'success' | 'warning';
  hint?: string;
}) {
  const tones = {
    default: 'text-slate-900',
    danger: 'text-red-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
  } as const;
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-400">{hint}</p> : null}
    </div>
  );
}
