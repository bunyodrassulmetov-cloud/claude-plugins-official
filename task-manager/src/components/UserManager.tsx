'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type UserRow = {
  id: number;
  email: string;
  fullName: string;
  position: string | null;
  role: 'ADMIN' | 'DIRECTOR' | 'CHIEF_ACCOUNTANT' | 'ACCOUNTANT';
  departmentId: number | null;
  managerId: number | null;
  isActive: boolean;
};

export type DepartmentOption = { id: number; name: string };

const ROLES: { value: UserRow['role']; label: string }[] = [
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'DIRECTOR', label: 'Директор' },
  { value: 'CHIEF_ACCOUNTANT', label: 'Главный бухгалтер' },
  { value: 'ACCOUNTANT', label: 'Бухгалтер / оператор' },
];

export default function UserManager({
  users,
  departments,
}: {
  users: UserRow[];
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    position: '',
    password: '',
    role: 'ACCOUNTANT' as UserRow['role'],
    departmentId: '',
    managerId: '',
  });

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        position: form.position || null,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        managerId: form.managerId ? Number(form.managerId) : null,
      }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось создать пользователя');
      return;
    }
    setForm({ email: '', fullName: '', position: '', password: '', role: 'ACCOUNTANT', departmentId: '', managerId: '' });
    router.refresh();
  }

  async function patch(id: number, data: Record<string, unknown>) {
    setError(null);
    const response = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось сохранить изменения');
      return;
    }
    router.refresh();
  }

  async function resetPassword(id: number) {
    const password = window.prompt('Новый пароль (минимум 8 символов):');
    if (!password) return;
    await patch(id, { password });
  }

  const managers = users.filter((u) => u.role !== 'ACCOUNTANT' && u.role !== 'ADMIN');

  return (
    <div className="space-y-6">
      <form onSubmit={createUser} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 sm:col-span-2 lg:col-span-3">
          Новый сотрудник
        </h2>
        <div>
          <label className="label" htmlFor="n-fullName">ФИО *</label>
          <input id="n-fullName" className="input" required value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="n-email">Email *</label>
          <input id="n-email" type="email" className="input" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="n-password">Пароль *</label>
          <input id="n-password" className="input" required minLength={8} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="n-position">Должность</label>
          <input id="n-position" className="input" value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="n-role">Роль *</label>
          <select id="n-role" className="input" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRow['role'] })}>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="n-department">Отдел</label>
          <select id="n-department" className="input" value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">— без отдела —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="n-manager">Руководитель</label>
          <select id="n-manager" className="input" value={form.managerId}
            onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
            <option value="">— не указан —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.fullName}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full" type="submit" disabled={pending}>
            {pending ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </form>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Отдел</th>
              <th className="px-4 py-3">Руководитель</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className={user.isActive ? '' : 'bg-slate-50 text-slate-400'}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{user.fullName}</p>
                  <p className="text-xs text-slate-400">{user.email}{user.position ? ` · ${user.position}` : ''}</p>
                </td>
                <td className="px-4 py-3">
                  <select className="input py-1" value={user.role}
                    onChange={(e) => patch(user.id, { role: e.target.value })}>
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select className="input py-1" value={user.departmentId ?? ''}
                    onChange={(e) => patch(user.id, { departmentId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select className="input py-1" value={user.managerId ?? ''}
                    onChange={(e) => patch(user.id, { managerId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {managers.filter((m) => m.id !== user.id).map((m) => (
                      <option key={m.id} value={m.id}>{m.fullName}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button type="button" className={user.isActive ? 'text-emerald-600' : 'text-slate-400'}
                    onClick={() => patch(user.id, { isActive: !user.isActive })}>
                    {user.isActive ? 'активен' : 'отключён'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="text-xs text-slate-500 hover:underline"
                    onClick={() => resetPassword(user.id)}>
                    сменить пароль
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Сотрудников не удаляем — на них ссылаются задачи и история. Уволенного переводите в «отключён».
      </p>
    </div>
  );
}
