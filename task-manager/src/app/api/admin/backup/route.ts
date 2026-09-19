import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { handle } from '@/lib/api';
import { canManageUsers } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * Выгрузка всех данных одним JSON — запасной вариант копии, не требующий
 * ни доступа к серверу, ни установленных программ. Полноценный дамп базы
 * снимается скриптом npm run backup или ночным заданием в GitHub Actions.
 */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageUsers(user)) throw new HttpError(403, 'Выгрузка доступна администратору');

    const [
      departments,
      users,
      tasks,
      taskAssignees,
      checklist,
      notes,
      attachments,
      activity,
      templates,
      reports,
      reportItems,
      settings,
    ] = await Promise.all([
      prisma.department.findMany(),
      // Хэши паролей и коды привязки в выгрузку не попадают
      prisma.user.findMany({
        select: {
          id: true, email: true, fullName: true, position: true, role: true,
          departmentId: true, managerId: true, isActive: true, approvalStatus: true,
          createdAt: true,
        },
      }),
      prisma.task.findMany(),
      prisma.taskAssignee.findMany(),
      prisma.checklistItem.findMany(),
      prisma.taskNote.findMany(),
      // Содержимое файлов не выгружаем: это метаданные, а не архив вложений
      prisma.attachment.findMany({
        select: {
          id: true, taskId: true, uploadedById: true, originalName: true,
          storedPath: true, mimeType: true, sizeBytes: true, createdAt: true,
        },
      }),
      prisma.taskActivity.findMany(),
      prisma.taskTemplate.findMany(),
      prisma.report.findMany(),
      prisma.reportItem.findMany(),
      prisma.appSetting.findMany(),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      counts: { users: users.length, tasks: tasks.length, templates: templates.length },
      data: {
        departments, users, tasks, taskAssignees, checklist, notes,
        attachments, activity, templates, reports, reportItems, settings,
      },
    };

    const name = `taskmanager-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 1), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
