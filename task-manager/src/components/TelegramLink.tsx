'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function TelegramLink({
  connected,
  botName,
}: {
  connected: boolean;
  botName: string | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setPending(true);
    setError(null);
    const response = await fetch('/api/telegram/link', { method: 'POST' });
    setPending(false);
    if (!response.ok) {
      setError('Не удалось получить код');
      return;
    }
    const payload = await response.json();
    setCode(payload.code);
  }

  async function disconnect() {
    if (!window.confirm('Отключить уведомления в Telegram?')) return;
    await fetch('/api/telegram/link', { method: 'DELETE' });
    setCode(null);
    router.refresh();
  }

  if (connected) {
    return (
      <div className="card max-w-md space-y-3 p-5">
        <p className="text-sm text-emerald-700">Telegram подключён — уведомления приходят в чат.</p>
        <button type="button" className="btn-danger" onClick={disconnect}>
          Отключить
        </button>
      </div>
    );
  }

  return (
    <div className="card max-w-md space-y-3 p-5">
      <p className="text-sm text-slate-600">
        Подключите Telegram, чтобы новые задачи и напоминания о сроках приходили в чат, а не только
        в приложение.
      </p>

      {code ? (
        <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
          <li>
            Откройте бота{' '}
            {botName ? (
              <a
                className="font-medium underline"
                href={`https://t.me/${botName.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
              >
                {botName}
              </a>
            ) : (
              'вашей компании в Telegram'
            )}
          </li>
          <li>
            Отправьте сообщение:
            <code className="ml-2 rounded bg-slate-100 px-2 py-1 font-mono text-sm">/start {code}</code>
          </li>
          <li>Бот ответит подтверждением — код одноразовый.</li>
        </ol>
      ) : (
        <button type="button" className="btn-primary" onClick={requestCode} disabled={pending}>
          {pending ? 'Готовлю код…' : 'Получить код привязки'}
        </button>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
