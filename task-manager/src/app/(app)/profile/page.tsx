import { requireUser } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/permissions';
import PasswordChangeForm from '@/components/PasswordChangeForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Профиль — Task Manager' };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Профиль</h1>
        <p className="text-sm text-slate-500">
          {user.fullName} · {ROLE_LABELS[user.role]}
          {user.departmentName ? ` · ${user.departmentName}` : ''}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Смена пароля
        </h2>
        <PasswordChangeForm />
      </div>
    </div>
  );
}
