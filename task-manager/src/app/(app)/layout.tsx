import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { config } from '@/lib/config';
import { unreadCount } from '@/lib/notifications';
import { isManager, isAdmin, ROLE_LABELS } from '@/lib/permissions';
import NavBar from '@/components/NavBar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const unread = await unreadCount(user.id);
  const links = [
    ...(isAdmin(user)
      ? []
      : [
          { href: '/dashboard', label: 'Мой день' },
          { href: '/tasks', label: 'Задачи' },
          { href: '/templates', label: 'Повторяющиеся' },
          { href: '/company', label: 'Компания' },
        ]),
    ...(isManager(user) ? [{ href: '/reports', label: 'Отчёты' }] : []),
    ...(isAdmin(user)
      ? [
          { href: '/admin/users', label: 'Сотрудники' },
          { href: '/admin/departments', label: 'Отделы' },
          { href: '/admin/settings', label: 'Настройки' },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <NavBar
        links={links}
        unread={unread}
        user={{ fullName: user.fullName, role: ROLE_LABELS[user.role], department: user.departmentName }}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-slate-400 sm:px-6 lg:px-8">
        Task Manager · {config.companyName} ·{' '}
        <Link className="underline" href="/notifications">
          уведомления
        </Link>
      </footer>
    </div>
  );
}
