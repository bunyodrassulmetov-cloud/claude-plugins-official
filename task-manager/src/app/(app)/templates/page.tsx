import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { describeRule } from '@/lib/recurrence';
import { visibleTemplatesFilter } from '@/app/api/templates/route';
import TemplateManager from '@/components/TemplateManager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Повторяющиеся задачи — Task Manager' };

export default async function TemplatesPage() {
  const user = await requireUser();
  if (isAdmin(user)) redirect('/admin/users');

  const { timezone } = await getSettings();
  const [templates, people] = await Promise.all([
    prisma.taskTemplate.findMany({
      where: await visibleTemplatesFilter(user),
      include: {
        assignee: { select: { fullName: true } },
        customer: { select: { fullName: true } },
      },
      orderBy: [{ isActive: 'desc' }, { nextDeadline: 'asc' }],
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { not: 'ADMIN' } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Повторяющиеся задачи</h1>
        <p className="text-sm text-slate-500">
          Шаблон сам создаёт задачу к очередному сроку — заводить руками каждый месяц не нужно.
        </p>
      </div>

      <TemplateManager
        currentUserId={user.id}
        people={people}
        templates={templates.map((template) => ({
          id: template.id,
          title: template.title,
          assignee: template.assignee.fullName,
          customer: template.customer.fullName,
          priority: template.priority,
          schedule: describeRule(template, timezone, template.nextDeadline),
          checklistCount: template.checklist.length,
          leadDays: template.leadDays,
          isActive: template.isActive,
        }))}
      />
    </div>
  );
}
