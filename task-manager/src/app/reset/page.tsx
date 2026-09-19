import { Suspense } from 'react';
import ResetForm from '@/components/ResetForm';
import { config } from '@/lib/config';

export const metadata = { title: 'Новый пароль — Task Manager' };

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Новый пароль</h1>
          <p className="mt-1 text-sm text-slate-500">{config.companyName}</p>
        </div>
        <Suspense fallback={<div className="card h-64 animate-pulse" />}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
