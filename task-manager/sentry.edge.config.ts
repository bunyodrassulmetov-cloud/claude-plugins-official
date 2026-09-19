import * as Sentry from '@sentry/nextjs';

/**
 * Мониторинг ошибок. Включается только при заданном SENTRY_DSN —
 * без него приложение работает как раньше, ничего никуда не отправляется.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Трассировку держим низкой: бесплатный тариф расходуется быстро
    tracesSampleRate: 0.05,
    // Из ошибок не должны утекать секреты и содержимое задач
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}
