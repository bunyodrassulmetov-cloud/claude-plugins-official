import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { canManageUsers } from '@/lib/permissions';
import UserManager from '@/components/UserManager';
import PendingApprovals from '@/components/PendingApprovals';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Сотрудники — Task Manager' };

export default async function AdminUsersPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect('/dashboard');

  const [users, departments, pending] = await Promise.all([
    prisma.user.findMany({
      where: { approvalStatus: { not: 'PENDING' } },
      select: {
        id: true, email: true, fullName: true, position: true,
        role: true, departmentId: true, managerId: true, isActive: true,
      },
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { approvalStatus: 'PENDING' },
      select: { id: true, email: true, fullName: true, signupNote: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Сотрудники</h1>
        <p className="text-sm text-slate-500">
          Роль определяет доступ: директор видит всё, главбух — свой отдел, бухгалтер — только свои задачи.
        </p>
      </div>
      <PendingApprovals
        departments={departments}
        managers={users.filter((item) => item.role === 'CHIEF_ACCOUNTANT' || item.role === 'DIRECTOR')}
        pending={pending.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
      />

      <UserManager users={users} departments={departments} />
    </div>
  );
}
