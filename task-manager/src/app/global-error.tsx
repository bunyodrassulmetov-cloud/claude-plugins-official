'use client';

import { useEffect } from 'react';

/** Экран на случай необработанной ошибки: человеку — понятный текст, разработчику — сигнал. */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error)).catch(() => undefined);
    }
  }, [error]);

  return (
    <html lang="ru">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Что-то пошло не так</h1>
        <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
          Ошибка записана. Попробуйте повторить действие или обновить страницу.
        </p>
        <button
          onClick={reset}
          style={{
            background: '#0f172a', color: '#fff', border: 0, borderRadius: 8,
            padding: '0.6rem 1.2rem', fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      </body>
    </html>
  );
}
