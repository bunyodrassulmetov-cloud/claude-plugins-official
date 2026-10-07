import { Suspense } from 'react';
import TelegramMiniApp from '@/components/TelegramMiniApp';

export const metadata = { title: 'Task Manager' };
export const dynamic = 'force-dynamic';

/** Точка входа мини-приложения: этот адрес указывается боту в BotFather. */
export default async function TelegramEntry({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Принимаем только внутренние адреса: так ссылка из чата не уведёт на чужой сайт
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  return (
    <Suspense fallback={null}>
      <TelegramMiniApp next={target} />
    </Suspense>
  );
}
