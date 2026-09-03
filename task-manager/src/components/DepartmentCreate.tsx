'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Быстрое добавление отдела прямо со страницы компании. */
export default function DepartmentCreate() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось создать отдел');
      return;
    }
    setName('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        + Добавить отдел
      </button>
    );
  }

  return (
    <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor="new-department">
          Название отдела
        </label>
        <input
          id="new-department"
          className="input"
          required
          minLength={2}
          autoFocus
          placeholder="Например: Отдел продаж"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? 'Создание…' : 'Создать'}
      </button>
      <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
        Отмена
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      <p className="w-full text-xs text-slate-400">
        Руководитель отдела назначается в разделе «Отделы» — без него по отделу не формируется сводка.
      </p>
    </form>
  );
}
