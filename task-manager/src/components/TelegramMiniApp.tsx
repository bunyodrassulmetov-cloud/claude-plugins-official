'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  themeParams?: { bg_color?: string };
  colorScheme?: 'light' | 'dark';
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type Stage = 'loading' | 'login' | 'error';

/**
 * Запуск внутри Telegram: приложение само узнаёт, кто его открыл, и пускает без пароля.
 * Если этот Telegram ещё не связан с учётной записью, один раз просим войти по email —
 * после этого связь сохраняется и пароль больше не понадобится.
 */
export default function TelegramMiniApp({ next }: { next: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [initData, setInitData] = useState<string | null>(null);

  const enter = useCallback(() => {
    router.replace(next);
    router.refresh();
  }, [router, next]);

  const start = useCallback(async () => {
    const app = window.Telegram?.WebApp;
    if (!app?.initData) {
      setStage('error');
      setMessage('Эта страница открывается из Telegram — через кнопку у бота компании.');
      return;
    }
    app.ready();
    app.expand();
    setInitData(app.initData);

    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: app.initData }),
    });

    if (response.ok) {
      enter();
      return;
    }
    if (response.status === 404) {
      setStage('login');
      return;
    }
    const payload = await response.json().catch(() => ({}));
    setStage('error');
    setMessage(payload.error ?? 'Не удалось войти');
  }, [enter]);

  useEffect(() => {
    // Скрипт Telegram мог загрузиться раньше, чем смонтировался компонент
    if (window.Telegram?.WebApp) {
      void start();
      return undefined;
    }
    // Если библиотека не ответила — не держим человека на «загружаем» бесконечно
    const timer = setTimeout(() => {
      setStage((current) => {
        if (current !== 'loading') return current;
        setMessage(
          'Telegram не ответил. Откройте приложение заново через кнопку у бота или зайдите на сайт в браузере.',
        );
        return 'error';
      });
    }, 6000);
    return () => clearTimeout(timer);
  }, [start]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const login = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) {
      const payload = await login.json().catch(() => ({}));
      setPending(false);
      setMessage(payload.error ?? 'Не удалось войти');
      return;
    }

    const attach = await fetch('/api/telegram/attach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    setPending(false);
    if (!attach.ok) {
      const payload = await attach.json().catch(() => ({}));
      setMessage(payload.error ?? 'Вход выполнен, но связать Telegram не удалось');
      // Войти всё равно получилось — не держим человека на этом экране
      setTimeout(enter, 1500);
      return;
    }
    enter();
  }

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => void start()}
        onError={() => {
          setStage('error');
          setMessage('Не удалось загрузить библиотеку Telegram. Проверьте связь и откройте заново.');
        }}
      />

      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {stage === 'loading' ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-slate-600">Открываем задачи…</p>
            </div>
          ) : null}

          {stage === 'error' ? (
            <div className="card space-y-3 p-6 text-center">
              <p className="text-sm font-medium text-slate-800">Не получилось открыть</p>
              <p className="text-sm text-slate-600">{message}</p>
              <a className="btn-secondary inline-block" href="/login">
                Войти через браузер
              </a>
            </div>
          ) : null}

          {stage === 'login' ? (
            <form onSubmit={signIn} className="card space-y-4 p-6">
              <div>
                <h1 className="text-base font-semibold text-slate-900">Первый вход</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Войдите по рабочей почте один раз — дальше приложение будет узнавать вас по
                  Telegram само.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="tma-email">
                  Email
                </label>
                <input
                  id="tma-email"
                  type="email"
                  className="input"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="tma-password">
                  Пароль
                </label>
                <input
                  id="tma-password"
                  type="password"
                  className="input"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {message ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {message}
                </p>
              ) : null}
              <button className="btn-primary w-full" type="submit" disabled={pending}>
                {pending ? 'Входим…' : 'Войти и связать'}
              </button>
            </form>
          ) : null}
        </div>
      </main>
    </>
  );
}
