'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RegisterForm() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', note: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, note: form.note || null }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось отправить заявку');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-sm font-medium text-emerald-700">Заявка отправлена</p>
        <p className="text-sm text-slate-600">
          Администратор подтвердит доступ — после этого можно будет войти под своим email и паролем.
        </p>
        <Link href="/login" className="btn-secondary inline-block">
          К странице входа
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="r-name">
          Фамилия и имя *
        </label>
        <input
          id="r-name"
          className="input"
          required
          minLength={3}
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="r-email">
          Email *
        </label>
        <input
          id="r-email"
          type="email"
          className="input"
          required
          autoComplete="username"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor="r-password">
          Пароль *
        </label>
        <input
          id="r-password"
          type="password"
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <p className="mt-1 text-xs text-slate-400">Минимум 8 символов, буквы и цифры.</p>
      </div>
      <div>
        <label className="label" htmlFor="r-note">
          Должность или отдел
        </label>
        <input
          id="r-note"
          className="input"
          maxLength={300}
          placeholder="Например: бухгалтер, расчётный отдел"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <p className="mt-1 text-xs text-slate-400">Поможет администратору понять, кому открывать доступ.</p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? 'Отправка…' : 'Отправить заявку'}
      </button>
      <p className="text-center text-sm text-slate-500">
        Уже есть доступ?{' '}
        <Link href="/login" className="underline">
          Войти
        </Link>
      </p>
    </form>
  );
}
