'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type DepartmentRow = {
  id: number;
  name: string;
  headId: number | null;
  head: { fullName: string } | null;
  _count: { members: number };
};

export default function DepartmentManager({
  departments,
  chiefs,
}: {
  departments: DepartmentRow[];
  chiefs: { id: number; fullName: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [headId, setHeadId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, headId: headId ? Number(headId) : null }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось создать отдел');
      return;
    }
    setName('');
    setHeadId('');
    router.refresh();
  }

  async function setHead(id: number, value: string) {
    const response = await fetch('/api/departments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, headId: value ? Number(value) : null }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось назначить руководителя');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="card grid gap-4 p-5 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="label" htmlFor="d-name">Название отдела *</label>
          <input id="d-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="d-head">Руководитель</label>
          <select id="d-head" className="input" value={headId} onChange={(e) => setHeadId(e.target.value)}>
            <option value="">— не назначен —</option>
            {chiefs.map((chief) => (
              <option key={chief.id} value={chief.id}>{chief.fullName}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full" type="submit" disabled={pending}>
            {pending ? 'Создание…' : 'Добавить отдел'}
          </button>
        </div>
      </form>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="card divide-y divide-slate-100">
        {departments.map((department) => (
          <div key={department.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{department.name}</p>
              <p className="text-xs text-slate-400">сотрудников: {department._count.members}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Руководитель
              <select
                className="input py-1"
                value={department.headId ?? ''}
                onChange={(e) => setHead(department.id, e.target.value)}
              >
                <option value="">— не назначен —</option>
                {chiefs.map((chief) => (
                  <option key={chief.id} value={chief.id}>{chief.fullName}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
        {departments.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Отделов пока нет.</p>
        ) : null}
      </div>
      <p className="text-xs text-slate-400">
        Ежедневный отчёт формируется для руководителя отдела: без назначенного руководителя сводка по отделу не строится.
      </p>
    </div>
  );
}
