/** Точка входа Next для серверной телеметрии. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  // Сигнатура совпадает с хуком Next, приводим тип на месте
  (Sentry.captureRequestError as (...a: unknown[]) => void)(...args);
}
