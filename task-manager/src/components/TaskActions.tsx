'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TaskStatus } from '@prisma/client';
import Dialog from './Dialog';

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
  /** Подтверждения показываем своим диалогом: window.confirm не работает
   *  во встроенных браузерах, кнопка просто не отзывалась бы. */
  const [dialog, setDialog] = useState<null | 'reject' | 'cancel' | 'delete'>(null);

  async function run(action: string, comment: string | null = null) {
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
            onClick={() => setDialog('reject')}
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
            onClick={() => setDialog('cancel')}
            type="button"
          >
            Отменить
          </button>
        ) : null}
        {abilities.remove ? (
          <button className="btn-danger" disabled={!!pending} onClick={() => setDialog('delete')} type="button">
            Удалить
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={dialog === 'reject'}
        title="Вернуть на доработку"
        description="Исполнитель получит уведомление, комментарий сохранится в заметках задачи."
        confirmLabel="Вернуть"
        pending={pending === 'reject'}
        input={{ label: 'Что нужно доработать?', required: true }}
        onCancel={() => setDialog(null)}
        onConfirm={async (comment) => {
          setDialog(null);
          await run('reject', comment);
        }}
      />

      <Dialog
        open={dialog === 'cancel'}
        title="Отменить задачу?"
        description="Задача останется в архиве, её можно будет вернуть в работу."
        confirmLabel="Отменить задачу"
        cancelLabel="Не отменять"
        tone="danger"
        pending={pending === 'cancel'}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          await run('cancel');
        }}
      />

      <Dialog
        open={dialog === 'delete'}
        title="Удалить задачу?"
        description="Вместе с заметками и вложениями. Действие необратимо — обычно достаточно отмены."
        confirmLabel="Удалить"
        tone="danger"
        pending={pending === 'delete'}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          await remove();
        }}
      />
    </div>
  );
}
