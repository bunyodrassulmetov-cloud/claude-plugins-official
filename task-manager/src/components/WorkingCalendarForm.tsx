'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Dialog from './Dialog';

export type Holiday = { day: string; name: string };

const WEEKDAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
];

/** Выходные дни недели и список праздников — от них зависит подсчёт просрочки. */
export default function WorkingCalendarForm({
  weekend,
  holidays,
  settings,
}: {
  weekend: number[];
  holidays: Holiday[];
  settings: { dailyReportTime: string; timezone: string; deadlineReminderHours: number };
}) {
  const router = useRouter();
  const [days, setDays] = useState<number[]>(weekend);
  const [draft, setDraft] = useState<Holiday>({ day: '', name: '' });
  const [toRemove, setToRemove] = useState<Holiday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function saveWeekend(next: number[]) {
    setDays(next);
    setError(null);
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, weekend: next }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось сохранить выходные');
      return;
    }
    setStatus('Выходные сохранены');
    router.refresh();
  }

  async function addHoliday(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/settings/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось добавить день');
      return;
    }
    setDraft({ day: '', name: '' });
    router.refresh();
  }

  async function removeHoliday(day: string) {
    await fetch(`/api/settings/holidays?day=${encodeURIComponent(day)}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <span className="label">Выходные дни недели</span>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((item) => {
            const active = days.includes(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  saveWeekend(
                    active ? days.filter((d) => d !== item.value) : [...days, item.value].sort(),
                  )
                }
                className={`min-h-10 min-w-12 rounded-lg border px-3 text-sm transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          За эти дни не копится просрочка, и вечерняя сводка не формируется.
        </p>
      </div>

      <div>
        <span className="label">Праздники и переносы</span>
        {holidays.length === 0 ? (
          <p className="text-sm text-slate-400">Список пуст.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {holidays.map((holiday) => (
              <li key={holiday.day} className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm text-slate-700">
                  <span className="tabular-nums text-slate-500">{holiday.day}</span> — {holiday.name}
                </span>
                <button
                  type="button"
                  className="rounded px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                  onClick={() => setToRemove(holiday)}
                >
                  удалить
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addHoliday} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="holiday-day">
              Дата
            </label>
            <input
              id="holiday-day"
              type="date"
              className="input"
              required
              value={draft.day}
              onChange={(e) => setDraft({ ...draft, day: e.target.value })}
            />
          </div>
          <div className="min-w-40 flex-1">
            <label className="label" htmlFor="holiday-name">
              Название
            </label>
            <input
              id="holiday-name"
              className="input"
              required
              placeholder="Например: День независимости"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <button className="btn-secondary" type="submit">
            Добавить
          </button>
        </form>
      </div>

      {status ? <p className="text-sm text-emerald-600">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Dialog
        open={toRemove !== null}
        title="Убрать из календаря?"
        description={toRemove ? `${toRemove.day} — ${toRemove.name}` : undefined}
        confirmLabel="Убрать"
        tone="danger"
        onCancel={() => setToRemove(null)}
        onConfirm={async () => {
          const holiday = toRemove;
          setToRemove(null);
          if (holiday) await removeHoliday(holiday.day);
        }}
      />
    </div>
  );
}
