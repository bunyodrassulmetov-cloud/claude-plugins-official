'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type ChecklistItemView = {
  id: number;
  title: string;
  isDone: boolean;
  doneBy: string | null;
};

/** Подзадачи внутри задачи: без своих сроков, просто разбивка работы на шаги. */
export default function Checklist({
  taskId,
  items,
  canEdit,
}: {
  taskId: number;
  items: ChecklistItemView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = items.filter((item) => item.isDone).length;

  async function send(url: string, method: string, body?: unknown) {
    setError(null);
    const response = await fetch(url, {
      method,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось сохранить изменение');
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    const okResult = await send(`/api/tasks/${taskId}/checklist`, 'POST', { title });
    setPending(false);
    if (okResult) setTitle('');
  }

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.round((done / items.length) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-slate-500">
              {done} из {items.length}
            </span>
          </div>

          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="group flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                  checked={item.isDone}
                  disabled={!canEdit}
                  onChange={(e) => send(`/api/checklist/${item.id}`, 'PATCH', { isDone: e.target.checked })}
                />
                <span
                  className={`flex-1 text-sm ${
                    item.isDone ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'
                  }`}
                >
                  {item.title}
                  {item.isDone && item.doneBy ? (
                    <span className="ml-2 text-xs text-slate-400">— {item.doneBy}</span>
                  ) : null}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                    onClick={() => send(`/api/checklist/${item.id}`, 'DELETE')}
                    aria-label={`Удалить пункт «${item.title}»`}
                  >
                    ✕
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-slate-400">Пунктов пока нет.</p>
      )}

      {canEdit ? (
        <form onSubmit={add} className="flex gap-2">
          <input
            className="input"
            placeholder="Добавить пункт…"
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="btn-secondary shrink-0" type="submit" disabled={pending || !title.trim()}>
            +
          </button>
        </form>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
