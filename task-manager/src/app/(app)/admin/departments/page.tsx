import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { canManageUsers } from '@/lib/permissions';
import DepartmentManager from '@/components/DepartmentManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Отделы — Task Manager' };

export default async function AdminDepartmentsPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect('/dashboard');

  const [departments, chiefs] = await Promise.all([
    prisma.department.findMany({
      include: { head: { select: { fullName: true } }, _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ['CHIEF_ACCOUNTANT', 'DIRECTOR'] } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Отделы</h1>
        <p className="text-sm text-slate-500">Состав отдела определяет зону видимости главного бухгалтера.</p>
      </div>
      <DepartmentManager departments={departments} chiefs={chiefs} />
    </div>
  );
}
