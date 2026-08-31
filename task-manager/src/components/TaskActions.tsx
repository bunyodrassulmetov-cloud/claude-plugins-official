'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TaskStatus } from '@prisma/client';

export type TaskAbilities = {
  submit: boolean;
  accept: boolean;
  reject: boolean;
  reopen: boolean;
  cancel: boolean;
  remove: boolean;
};

export default function TaskActions({
  taskId,
  status,
  abilities,
  hasAcceptor,
}: {
  taskId: number;
  status: TaskStatus;
  abilities: TaskAbilities;
  hasAcceptor: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, options?: { prompt?: string; confirm?: string }) {
    let comment: string | null = null;
    if (options?.prompt) {
      comment = window.prompt(options.prompt) ?? null;
      if (comment === null) return;
    }
    if (options?.confirm && !window.confirm(options.confirm)) return;

    setPending(action);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment }),
    });
    setPending(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось выполнить действие');
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!window.confirm('Удалить задачу вместе с заметками и вложениями? Действие необратимо.')) return;
    setPending('delete');
    const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    setPending(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось удалить задачу');
      return;
    }
    router.push('/tasks');
    router.refresh();
  }

  const open = status === 'IN_PROGRESS' || status === 'PENDING_ACCEPTANCE';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {abilities.submit && status === 'IN_PROGRESS' ? (
          <button className="btn-success" disabled={!!pending} onClick={() => run('submit')} type="button">
            {hasAcceptor ? 'Сдать на приёмку' : 'Отметить выполненной'}
          </button>
        ) : null}
        {abilities.accept && status === 'PENDING_ACCEPTANCE' ? (
          <button className="btn-success" disabled={!!pending} onClick={() => run('accept')} type="button">
            Принять результат
          </button>
        ) : null}
        {abilities.reject && status === 'PENDING_ACCEPTANCE' ? (
          <button
            className="btn-secondary"
            disabled={!!pending}
            onClick={() => run('reject', { prompt: 'Что нужно доработать?' })}
            type="button"
          >
            Вернуть на доработку
          </button>
        ) : null}
        {abilities.reopen && !open ? (
          <button className="btn-secondary" disabled={!!pending} onClick={() => run('reopen')} type="button">
            Вернуть в работу
          </button>
        ) : null}
        {abilities.cancel && open ? (
          <button
            className="btn-danger"
            disabled={!!pending}
            onClick={() => run('cancel', { confirm: 'Отменить задачу? Она останется в архиве.' })}
            type="button"
          >
            Отменить
          </button>
        ) : null}
        {abilities.remove ? (
          <button className="btn-danger" disabled={!!pending} onClick={remove} type="button">
            Удалить
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
