'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== repeat) {
      setError('Пароль и повтор не совпадают');
      return;
    }
    setPending(true);
    const response = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось изменить пароль');
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/login'), 2500);
  }

  if (!token) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-sm text-slate-600">Ссылка неполная — откройте её целиком из письма.</p>
        <Link href="/forgot" className="btn-secondary inline-block">
          Запросить новую
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card space-y-2 p-6 text-center">
        <p className="text-sm font-medium text-emerald-700">Пароль изменён</p>
        <p className="text-sm text-slate-600">Сейчас откроется страница входа…</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="new-password">
          Новый пароль
        </label>
        <input
          id="new-password"
          type="password"
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">Минимум 8 символов, буквы и цифры.</p>
      </div>
      <div>
        <label className="label" htmlFor="repeat-password">
          Повторите пароль
        </label>
        <input
          id="repeat-password"
          type="password"
          className="input"
          required
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? 'Сохранение…' : 'Задать пароль'}
      </button>
    </form>
  );
}
