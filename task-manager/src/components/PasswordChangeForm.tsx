'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PasswordChangeForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== repeat) {
      setError('Новый пароль и повтор не совпадают');
      return;
    }
    setPending(true);
    const response = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось сменить пароль');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setRepeat('');
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card max-w-md space-y-4 p-5">
      <div>
        <label className="label" htmlFor="current">
          Текущий пароль
        </label>
        <input
          id="current"
          type="password"
          className="input"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="next">
          Новый пароль
        </label>
        <input
          id="next"
          type="password"
          className="input"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">Минимум 8 символов, буквы и цифры.</p>
      </div>
      <div>
        <label className="label" htmlFor="repeat">
          Повторите новый пароль
        </label>
        <input
          id="repeat"
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
      {done ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Пароль изменён.
        </p>
      ) : null}

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? 'Сохранение…' : 'Сменить пароль'}
      </button>
    </form>
  );
}
