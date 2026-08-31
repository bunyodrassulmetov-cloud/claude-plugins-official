import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { formatDateTime } from '@/lib/dates';
import MarkAllRead from '@/components/MarkAllRead';
import { EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Уведомления — Task Manager' };

const TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'Новая задача',
  TASK_UPDATED: 'Изменение',
  TASK_SUBMITTED: 'Сдано на приёмку',
  TASK_ACCEPTED: 'Принято',
  TASK_REJECTED: 'На доработку',
  DEADLINE_SOON: 'Скоро дедлайн',
  TASK_OVERDUE: 'Просрочено',
  REPORT_READY: 'Отчёт готов',
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const { timezone } = await getSettings();
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Уведомления</h1>
          <p className="text-sm text-slate-500">Непрочитанных: {unread}</p>
        </div>
        {unread > 0 ? <MarkAllRead /> : null}
      </div>

      {items.length === 0 ? (
        <EmptyState title="Уведомлений нет" />
      ) : (
        <ul className="card divide-y divide-slate-100">
          {items.map((item) => {
            const content = (
              <div className={`px-4 py-3 ${item.isRead ? '' : 'bg-slate-50'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-slate-100 text-slate-600">
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{item.title}</span>
                  {!item.isRead ? <span className="h-2 w-2 rounded-full bg-red-500" aria-label="не прочитано" /> : null}
                </div>
                {item.body ? <p className="mt-1 text-sm text-slate-600">{item.body}</p> : null}
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.createdAt, timezone)}</p>
              </div>
            );
            return (
              <li key={item.id}>
                {item.taskId ? (
                  <Link href={`/tasks/${item.taskId}`} className="block hover:bg-slate-50">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
