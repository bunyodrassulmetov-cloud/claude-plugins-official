import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assignableUserIds, isAdmin } from '@/lib/permissions';
import TaskForm from '@/components/TaskForm';
import { toInputValue } from '@/lib/dates';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Новая задача — Task Manager' };

export default async function NewTaskPage() {
  const user = await requireUser();
  if (isAdmin(user)) redirect('/admin/users');

  const allowed = await assignableUserIds(user);
  const people = await prisma.user.findMany({
    where: { isActive: true, role: { not: 'ADMIN' } },
    select: { id: true, fullName: true, position: true },
    orderBy: { fullName: 'asc' },
  });
  const assignees = allowed === 'ALL' ? people : people.filter((p) => allowed.includes(p.id));

  const { timezone } = await getSettings();
  // Дедлайн по умолчанию — сегодня 18:00 по рабочему часовому поясу
  const defaultDeadline = toInputValue(new Date(), timezone).slice(0, 10) + 'T18:00';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Новая задача</h1>
        <p className="text-sm text-slate-500">
          {allowed === 'ALL'
            ? 'Вы можете поставить задачу любому сотруднику.'
            : assignees.length > 1
              ? 'Вы можете поставить задачу себе или своим подчинённым.'
              : 'Вы можете поставить задачу себе.'}
        </p>
      </div>
      <TaskForm
        mode="create"
        timezone={timezone}
        canChangeAssignee={assignees.length > 1}
        assignees={assignees}
        people={people}
        initial={{
          title: '',
          description: '',
          assigneeId: assignees.length === 1 ? assignees[0].id : user.id,
          customerId: user.id,
          acceptorId: '',
          priority: 'MEDIUM',
          deadline: defaultDeadline,
        }}
      />
    </div>
  );
}
