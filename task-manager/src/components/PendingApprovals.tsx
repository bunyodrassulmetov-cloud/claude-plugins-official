'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DepartmentOption, UserRow } from './UserManager';

export type PendingUser = {
  id: number;
  email: string;
  fullName: string;
  signupNote: string | null;
  createdAt: string;
};

const ROLES: { value: UserRow['role']; label: string }[] = [
  { value: 'ACCOUNTANT', label: 'Сотрудник' },
  { value: 'CHIEF_ACCOUNTANT', label: 'Главный бухгалтер' },
  { value: 'DIRECTOR', label: 'Директор' },
  { value: 'ADMIN', label: 'Администратор' },
];

/** Заявки на доступ: администратор задаёт роль и отдел прямо при подтверждении. */
export default function PendingApprovals({
  pending,
  departments,
  managers,
}: {
  pending: PendingUser[];
  departments: DepartmentOption[];
  managers: { id: number; fullName: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { role: string; departmentId: string; managerId: string; position: string }>>(
    Object.fromEntries(
      pending.map((user) => [user.id, { role: 'ACCOUNTANT', departmentId: '', managerId: '', position: '' }]),
    ),
  );

  if (pending.length === 0) return null;

  function draft(id: number) {
    return drafts[id] ?? { role: 'ACCOUNTANT', departmentId: '', managerId: '', position: '' };
  }

  async function decide(id: number, approve: boolean) {
    setBusy(id);
    setError(null);
    const current = draft(id);
    const response = await fetch(`/api/users/${id}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approve,
        ...(approve
          ? {
              role: current.role,
              departmentId: current.departmentId ? Number(current.departmentId) : null,
              managerId: current.managerId ? Number(current.managerId) : null,
              position: current.position || null,
            }
          : {}),
      }),
    });
    setBusy(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось обработать заявку');
      return;
    }
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
        Заявки на доступ <span className="text-slate-400">{pending.length}</span>
      </h2>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <ul className="card divide-y divide-slate-100">
        {pending.map((user) => (
          <li key={user.id} className="space-y-3 p-4">
            <div>
              <p className="font-medium text-slate-800">{user.fullName}</p>
              <p className="text-xs text-slate-500">
                {user.email}
                {user.signupNote ? ` · о себе: ${user.signupNote}` : ''}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="label" htmlFor={`role-${user.id}`}>
                  Роль
                </label>
                <select
                  id={`role-${user.id}`}
                  className="input py-1"
                  value={draft(user.id).role}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [user.id]: { ...draft(user.id), role: e.target.value } })
                  }
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`dep-${user.id}`}>
                  Отдел
                </label>
                <select
                  id={`dep-${user.id}`}
                  className="input py-1"
                  value={draft(user.id).departmentId}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [user.id]: { ...draft(user.id), departmentId: e.target.value } })
                  }
                >
                  <option value="">—</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`man-${user.id}`}>
                  Руководитель
                </label>
                <select
                  id={`man-${user.id}`}
                  className="input py-1"
                  value={draft(user.id).managerId}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [user.id]: { ...draft(user.id), managerId: e.target.value } })
                  }
                >
                  <option value="">—</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`pos-${user.id}`}>
                  Должность
                </label>
                <input
                  id={`pos-${user.id}`}
                  className="input py-1"
                  value={draft(user.id).position}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [user.id]: { ...draft(user.id), position: e.target.value } })
                  }
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="btn-success"
                disabled={busy === user.id}
                onClick={() => decide(user.id, true)}
              >
                Открыть доступ
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={busy === user.id}
                onClick={() => decide(user.id, false)}
              >
                Отклонить
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
