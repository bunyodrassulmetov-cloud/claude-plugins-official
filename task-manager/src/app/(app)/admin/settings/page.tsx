import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { canManageUsers } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import SettingsForm from '@/components/SettingsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Настройки — Task Manager' };

export default async function AdminSettingsPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect('/dashboard');
  const settings = await getSettings();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Настройки</h1>
        <p className="text-sm text-slate-500">
          Время формирования сводки, рабочий часовой пояс и окно напоминаний о дедлайнах.
        </p>
      </div>
      <SettingsForm initial={settings} />
      <div className="card space-y-2 p-5 text-sm text-slate-600">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Регламент планировщика</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>00:05 — пометка просроченных задач и перенос хвостов в текущий день</li>
          <li>каждый час — напоминания о приближающихся дедлайнах</li>
          <li>{settings.dailyReportTime} (пн–пт) — ежедневная сводка руководителям</li>
          <li>{settings.dailyReportTime} (пт) — недельная сводка, 1-е число — месячная</li>
        </ul>
      </div>
    </div>
  );
}
