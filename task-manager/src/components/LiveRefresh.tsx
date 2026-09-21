'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const INTERVAL_MS = 30_000;

/**
 * Держит открытую страницу в актуальном состоянии: новая задача и уведомление
 * появляются сами. Опрашивается лёгкий эндпоинт, и только при изменении
 * запрашивается перерисовка — постоянных запросов к данным страницы нет.
 */
export default function LiveRefresh() {
  const router = useRouter();
  const signature = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (busy.current || document.hidden) return;
      busy.current = true;
      try {
        const response = await fetch('/api/pulse', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { unread: number; tasksUpdatedAt: string | null };
        const next = `${data.unread}|${data.tasksUpdatedAt ?? ''}`;
        if (signature.current !== null && signature.current !== next && !cancelled) {
          router.refresh();
        }
        signature.current = next;
      } catch {
        // сеть пропала — просто попробуем в следующий раз
      } finally {
        busy.current = false;
      }
    }

    void check();
    const timer = setInterval(check, INTERVAL_MS);
    // Возврат к вкладке — самый частый момент, когда данные уже устарели
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [router]);

  return null;
}
