'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SettingsForm({
  initial,
}: {
  initial: { dailyReportTime: string; timezone: string; deadlineReminderHours: number };
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setStatus(null);
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось сохранить настройки');
      return;
    }
    setStatus('Сохранено. Планировщик подхватит время отчёта после перезапуска воркера.');
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor="s-time">Время ежедневного отчёта</label>
        <input
          id="s-time"
          type="time"
          className="input"
          required
          value={values.dailyReportTime}
          onChange={(e) => setValues({ ...values, dailyReportTime: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="s-tz">Часовой пояс</label>
        <input
          id="s-tz"
          className="input"
          required
          placeholder="Europe/Moscow"
          value={values.timezone}
          onChange={(e) => setValues({ ...values, timezone: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="s-hours">Напоминать за (часов)</label>
        <input
          id="s-hours"
          type="number"
          min={1}
          max={168}
          className="input"
          required
          value={values.deadlineReminderHours}
          onChange={(e) => setValues({ ...values, deadlineReminderHours: Number(e.target.value) })}
        />
      </div>
      <div className="sm:col-span-3">
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
      {status ? <p className="text-sm text-emerald-600 sm:col-span-3">{status}</p> : null}
      {error ? <p className="text-sm text-red-600 sm:col-span-3">{error}</p> : null}
    </form>
  );
}
