import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assignableUserIds, canEditTask } from '@/lib/permissions';
import { getTaskForUser } from '@/lib/task-actions';
import TaskForm from '@/components/TaskForm';
import { toInputValue } from '@/lib/dates';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Редактирование задачи — Task Manager' };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId)) notFound();

  const task = await getTaskForUser(user, taskId);
  if (!(await canEditTask(user, task))) redirect(`/tasks/${taskId}`);

  const { timezone } = await getSettings();
  const allowed = await assignableUserIds(user);
  const people = await prisma.user.findMany({
    where: { isActive: true, role: { not: 'ADMIN' } },
    select: { id: true, fullName: true, position: true },
    orderBy: { fullName: 'asc' },
  });
  const assignees = allowed === 'ALL' ? people : people.filter((p) => allowed.includes(p.id));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">Редактирование задачи</h1>
      <TaskForm
        mode="edit"
        timezone={timezone}
        canChangeAssignee={assignees.length > 1}
        assignees={assignees.some((a) => a.id === task.assigneeId) ? assignees : [task.assignee, ...assignees]}
        people={people}
        initial={{
          id: task.id,
          title: task.title,
          description: task.description ?? '',
          assigneeId: task.assigneeId,
          customerId: task.customerId,
          acceptorId: task.acceptorId ?? '',
          coAssigneeIds: task.coAssignees.map((item) => item.userId),
          priority: task.priority,
          deadline: toInputValue(task.deadline, timezone),
        }}
      />
    </div>
  );
}
