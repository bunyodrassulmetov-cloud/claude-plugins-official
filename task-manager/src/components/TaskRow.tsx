'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TaskRowData } from '@/lib/tasks';
import { PRIORITY_BAR, PRIORITY_LABELS, StatusBadge } from './ui';

/**
 * Компактная строка списка: одна строка на задачу.
 * Стрелка раскрывает подробности прямо в списке, клик по названию открывает задачу.
 */
export default function TaskRow({ task }: { task: TaskRowData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Быстрое действие прямо из строки — без перехода в карточку задачи. */
  async function run(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    const response = await fetch(`/api/tasks/${task.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось выполнить действие');
      return;
    }
    router.refresh();
  }

  return (
    <li className="border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 sm:gap-3 sm:px-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Свернуть' : 'Показать подробности'}
          className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <span className={`block transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        </button>

        <span
          className={`h-6 w-1 shrink-0 rounded ${task.closed ? 'bg-slate-200' : PRIORITY_BAR[task.priority]}`}
          title={`Приоритет: ${PRIORITY_LABELS[task.priority]}`}
        />

        <Link
          href={`/tasks/${task.id}`}
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            task.closed
              ? 'text-slate-400 line-through decoration-slate-300'
              : 'text-slate-800 hover:text-slate-950 hover:underline'
          }`}
          title={task.title}
        >
          {task.title}
        </Link>

        <span className="hidden shrink-0 text-xs text-slate-500 md:inline">
          {task.assignee}
          {task.coAssignees.length > 0 ? ` +${task.coAssignees.length}` : ''}
        </span>

        {task.checklistTotal > 0 ? (
          <span
            className={`hidden shrink-0 text-xs sm:inline ${
              task.checklistDone === task.checklistTotal ? 'text-emerald-600' : 'text-slate-400'
            }`}
            title="Выполнено пунктов чек-листа"
          >
            ✓ {task.checklistDone}/{task.checklistTotal}
          </span>
        ) : null}

        {task.attachments > 0 ? (
          <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">📎{task.attachments}</span>
        ) : null}

        <span
          className={`shrink-0 text-xs tabular-nums ${task.overdue ? 'text-red-600' : 'text-slate-500'}`}
        >
          {task.deadlineText}
        </span>

        <span className="hidden shrink-0 sm:block">
          <StatusBadge status={task.status} overdue={task.overdue} />
        </span>

        <span className="flex shrink-0 items-center gap-1">
          {task.canSubmit ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('submit')}
              title={task.hasAcceptor ? 'Сдать на приёмку' : 'Отметить выполненной'}
              aria-label={task.hasAcceptor ? 'Сдать на приёмку' : 'Отметить выполненной'}
              className="rounded p-1 text-slate-300 transition hover:bg-emerald-50 hover:text-emerald-600"
            >
              ✔
            </button>
          ) : null}
          {task.canAccept ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('accept')}
              title="Принять результат"
              aria-label="Принять результат"
              className="rounded p-1 text-amber-500 transition hover:bg-emerald-50 hover:text-emerald-600"
            >
              ✔
            </button>
          ) : null}
          {task.canPostpone ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run('postpone', { days: 1 })}
              title="Перенести срок на день"
              aria-label="Перенести срок на день"
              className="rounded p-1 text-slate-300 transition hover:bg-slate-200 hover:text-slate-700"
            >
              →
            </button>
          ) : null}
        </span>
      </div>

      {error ? (
        <p className="px-4 pb-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="space-y-3 bg-slate-50 px-4 py-3 pl-10 text-sm sm:pl-12">
          {task.description ? (
            <p className="whitespace-pre-wrap text-slate-600">{task.description}</p>
          ) : (
            <p className="text-slate-400">Описание не заполнено.</p>
          )}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Исполнитель" value={task.assignee} />
            {task.coAssignees.length > 0 ? (
              <Field label="Со-исполнители" value={task.coAssignees.join(', ')} />
            ) : null}
            <Field label="Заказчик" value={task.customer} />
            <Field label="Принимает" value={task.acceptor ?? 'приёмка не требуется'} />
            {task.department ? <Field label="Отдел" value={task.department} /> : null}
            <Field
              label="Дедлайн"
              value={`${task.deadlineText}${task.closed ? '' : ` · ${task.deadlineHuman}`}`}
              tone={task.overdue ? 'danger' : 'default'}
            />
            {task.completedText ? <Field label="Выполнена" value={task.completedText} /> : null}
            {task.carryOverDays > 0 && !task.closed ? (
              <Field label="Переносится" value={`${task.carryOverDays} дн.`} tone="danger" />
            ) : null}
            {task.checklistTotal > 0 ? (
              <Field label="Чек-лист" value={`${task.checklistDone} из ${task.checklistTotal}`} />
            ) : null}
            {task.notes > 0 ? <Field label="Заметок" value={String(task.notes)} /> : null}
            {task.attachments > 0 ? <Field label="Вложений" value={String(task.attachments)} /> : null}
          </dl>

          <Link href={`/tasks/${task.id}`} className="btn-secondary">
            Открыть задачу →
          </Link>
        </div>
      ) : null}
    </li>
  );
}

function Field({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="flex gap-1">
      <dt className="text-slate-400">{label}:</dt>
      <dd className={`font-medium ${tone === 'danger' ? 'text-red-600' : 'text-slate-700'}`}>{value}</dd>
    </div>
  );
}
