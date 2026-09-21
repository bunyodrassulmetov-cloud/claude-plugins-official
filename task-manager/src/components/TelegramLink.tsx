'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Dialog from './Dialog';

/**
 * Подключение Telegram. На телефоне главное — ссылка вида t.me/бот?start=КОД:
 * по ней Telegram открывает бота и сам отправляет команду, вручную набирать код
 * не нужно. Код рядом остаётся для случая, когда бота открывают на другом устройстве.
 */
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
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const bot = botName?.replace('@', '').trim() || null;
  const deepLink = bot && code ? `https://t.me/${bot}?start=${code}` : null;

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

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`/start ${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Скопируйте команду вручную');
    }
  }

  async function disconnect() {
    await fetch('/api/telegram/link', { method: 'DELETE' });
    setCode(null);
    router.refresh();
  }

  if (connected) {
    return (
      <div className="card max-w-md space-y-3 p-5">
        <p className="text-sm text-emerald-700">Telegram подключён — уведомления приходят в чат.</p>
        <p className="text-xs text-slate-500">
          Ответьте на сообщение бота о задаче, чтобы добавить к ней заметку.
        </p>
        <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
          Отключить
        </button>
        <Dialog
          open={confirming}
          title="Отключить Telegram?"
          description="Уведомления останутся только внутри приложения. Подключить можно в любой момент."
          confirmLabel="Отключить"
          tone="danger"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false);
            await disconnect();
          }}
        />
      </div>
    );
  }

  return (
    <div className="card max-w-md space-y-3 p-5">
      <p className="text-sm text-slate-600">
        Новые задачи, напоминания о сроках и итоги дня будут приходить в Telegram.
      </p>

      {!code ? (
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={requestCode} disabled={pending}>
          {pending ? 'Готовлю…' : 'Подключить Telegram'}
        </button>
      ) : (
        <div className="space-y-3">
          {deepLink ? (
            <>
              <a className="btn-primary w-full" href={deepLink} target="_blank" rel="noreferrer">
                Открыть бота и подключить
              </a>
              <p className="text-xs text-slate-500">
                Откроется чат с ботом — нажмите в нём «Запустить» (Start). Больше ничего вводить
                не нужно.
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-700">
              Имя бота не настроено. Откройте бота вашей компании в Telegram и отправьте команду
              ниже.
            </p>
          )}

          <div className="rounded-lg bg-slate-50 p-3">
            <p className="mb-1 text-xs text-slate-500">
              Если открываете бота на другом устройстве — отправьте ему команду:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="select-all rounded bg-white px-2 py-1 font-mono text-sm text-slate-800">
                /start {code}
              </code>
              <button type="button" className="btn-secondary" onClick={copyCode}>
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>

          <button type="button" className="text-sm text-slate-500 underline" onClick={requestCode}>
            Получить новый код
          </button>
        </div>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
