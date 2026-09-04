'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

type NavLink = { href: string; label: string };

export default function NavBar({
  links,
  unread,
  user,
}: {
  links: NavLink[];
  unread: number;
  user: { fullName: string; role: string; department: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname === href || pathname.startsWith(`${href}/`)
        ? 'bg-slate-900 text-white'
        : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="text-base font-semibold text-slate-900">
            Task&nbsp;Manager
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            className="relative rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            aria-label={`Уведомления${unread > 0 ? `, непрочитанных: ${unread}` : ''}`}
          >
            🔔
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </Link>
          <Link href="/profile" className="hidden rounded-lg px-2 py-1 text-right hover:bg-slate-100 sm:block">
            <p className="text-sm font-medium text-slate-800">{user.fullName}</p>
            <p className="text-xs text-slate-500">
              {user.role}
              {user.department ? ` · ${user.department}` : ''}
            </p>
          </Link>
          <button className="btn-secondary" onClick={logout} type="button">
            Выйти
          </button>
          <button
            className="btn-secondary md:hidden"
            onClick={() => setOpen((v) => !v)}
            type="button"
            aria-expanded={open}
            aria-label="Меню"
          >
            ☰
          </button>
        </div>
      </div>

      {open ? (
        <nav className="flex flex-col gap-1 border-t border-slate-200 px-4 py-2 md:hidden">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
