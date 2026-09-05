import Link from 'next/link';
import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';
import { config } from '@/lib/config';

export const metadata = { title: 'Вход — Task Manager' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Task Manager</h1>
          <p className="mt-1 text-sm text-slate-500">{config.companyName}</p>
        </div>
        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-slate-500">
          Нет доступа?{' '}
          <Link href="/register" className="underline">
            Отправить заявку
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">
          Забыли пароль — обратитесь к администратору.
        </p>
      </div>
    </main>
  );
}
