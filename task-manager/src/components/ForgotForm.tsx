'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ForgotForm() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось отправить письмо');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-sm font-medium text-emerald-700">Письмо отправлено</p>
        <p className="text-sm text-slate-600">
          Если такой адрес заведён в системе, на него придёт ссылка для смены пароля. Она
          действует час и срабатывает один раз.
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
        <label className="label" htmlFor="f-email">
          Ваш email
        </label>
        <input
          id="f-email"
          type="email"
          className="input"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? 'Отправка…' : 'Прислать ссылку'}
      </button>
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="underline">
          Вернуться ко входу
        </Link>
      </p>
    </form>
  );
}
