import RegisterForm from '@/components/RegisterForm';
import { config } from '@/lib/config';

export const metadata = { title: 'Регистрация — Task Manager' };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Заявка на доступ</h1>
          <p className="mt-1 text-sm text-slate-500">{config.companyName}</p>
        </div>
        <RegisterForm />
        <p className="mt-6 text-center text-xs text-slate-400">
          Доступ открывает администратор после проверки заявки.
        </p>
      </div>
    </main>
  );
}
