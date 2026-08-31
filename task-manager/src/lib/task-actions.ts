import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { HttpError, type SessionUser } from './auth';
import { notify } from './notifications';
import { logActivity, OPEN_STATUSES, taskInclude } from './tasks';
import {
  canAcceptTask,
  canCancelTask,
  canEditTask,
  canSubmitTask,
  canAssignTo,
  canViewTask,
} from './permissions';
import { formatDateTime } from './dates';

type TaskInput = {
  title: string;
  description?: string | null;
  assigneeId: number;
  customerId: number;
  acceptorId?: number | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline: Date;
  note?: string | null;
};

async function assertUsersExist(ids: (number | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter((id): id is number => typeof id === 'number')));
  if (unique.length === 0) return;
  const found = await prisma.user.count({ where: { id: { in: unique }, isActive: true } });
  if (found !== unique.length) throw new HttpError(422, 'Указан несуществующий или отключённый сотрудник');
}

export async function getTaskOr404(id: number) {
  const task = await prisma.task.findUnique({ where: { id }, include: taskInclude });
  if (!task) throw new HttpError(404, 'Задача не найдена');
  return task;
}

export async function getTaskForUser(user: SessionUser, id: number) {
  const task = await getTaskOr404(id);
  if (!(await canViewTask(user, task))) throw new HttpError(403, 'Нет доступа к этой задаче');
  return task;
}

export async function createTask(user: SessionUser, input: TaskInput) {
  if (!(await canAssignTo(user, input.assigneeId))) {
    throw new HttpError(403, 'Вы не можете назначать задачи этому сотруднику');
  }
  await assertUsersExist([input.assigneeId, input.customerId, input.acceptorId]);

  const assignee = await prisma.user.findUniqueOrThrow({
    where: { id: input.assigneeId },
    select: { departmentId: true, fullName: true },
  });

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      assigneeId: input.assigneeId,
      customerId: input.customerId,
      acceptorId: input.acceptorId ?? null,
      createdById: user.id,
      departmentId: assignee.departmentId,
      priority: input.priority,
      deadline: input.deadline,
      isOverdue: input.deadline < new Date(),
      overdueSince: input.deadline < new Date() ? input.deadline : null,
      notes: input.note ? { create: { authorId: user.id, body: input.note } } : undefined,
    },
    include: taskInclude,
  });

  await logActivity(task.id, user.id, 'created', { title: task.title });
  await notify(
    [
      {
        userId: task.assigneeId,
        type: 'TASK_ASSIGNED' as const,
        taskId: task.id,
        title: 'Новая задача',
        body: `«${task.title}» — срок ${formatDateTime(task.deadline)}.`,
      },
      ...(task.acceptorId
        ? [
            {
              userId: task.acceptorId,
              type: 'TASK_ASSIGNED' as const,
              taskId: task.id,
              title: 'Вы принимающий по задаче',
              body: `«${task.title}» — исполнитель ${assignee.fullName}.`,
            },
          ]
        : []),
    ],
    user.id,
  );

  return task;
}

export async function updateTask(user: SessionUser, id: number, input: Partial<TaskInput>) {
  const task = await getTaskOr404(id);
  if (!(await canEditTask(user, task))) throw new HttpError(403, 'Нет прав на редактирование задачи');

  if (input.assigneeId && input.assigneeId !== task.assigneeId) {
    if (!(await canAssignTo(user, input.assigneeId))) {
      throw new HttpError(403, 'Вы не можете назначать задачи этому сотруднику');
    }
  }
  await assertUsersExist([input.assigneeId, input.customerId, input.acceptorId]);

  const data: Prisma.TaskUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.deadline !== undefined) {
    data.deadline = input.deadline;
    const stillOverdue = input.deadline < new Date() && OPEN_STATUSES.includes(task.status);
    data.isOverdue = stillOverdue;
    if (!stillOverdue) {
      data.overdueSince = null;
      data.carryOverDays = 0;
    }
  }
  if (input.assigneeId !== undefined) {
    data.assignee = { connect: { id: input.assigneeId } };
    const assignee = await prisma.user.findUniqueOrThrow({
      where: { id: input.assigneeId },
      select: { departmentId: true },
    });
    data.department = assignee.departmentId
      ? { connect: { id: assignee.departmentId } }
      : { disconnect: true };
  }
  if (input.customerId !== undefined) data.customer = { connect: { id: input.customerId } };
  if (input.acceptorId !== undefined) {
    data.acceptor = input.acceptorId ? { connect: { id: input.acceptorId } } : { disconnect: true };
  }

  const updated = await prisma.task.update({ where: { id }, data, include: taskInclude });
  await logActivity(id, user.id, 'updated', { fields: Object.keys(data) });

  const recipients = new Set<number>([updated.assigneeId]);
  if (updated.acceptorId) recipients.add(updated.acceptorId);
  if (input.assigneeId && input.assigneeId !== task.assigneeId) recipients.add(task.assigneeId);
  await notify(
    Array.from(recipients).map((userId) => ({
      userId,
      type: 'TASK_UPDATED' as const,
      taskId: id,
      title: 'Задача изменена',
      body: `«${updated.title}» обновил(а) ${user.fullName}.`,
    })),
    user.id,
  );

  return updated;
}

export type TaskAction = 'submit' | 'accept' | 'reject' | 'reopen' | 'cancel' | 'complete';

/**
 * Переходы статусов.
 * IN_PROGRESS --submit--> PENDING_ACCEPTANCE --accept--> DONE
 *                     \--(без принимающего)--> DONE
 * PENDING_ACCEPTANCE --reject--> IN_PROGRESS
 * DONE|CANCELLED --reopen--> IN_PROGRESS
 */
export async function applyTaskAction(
  user: SessionUser,
  id: number,
  action: TaskAction,
  comment?: string | null,
) {
  const task = await getTaskOr404(id);
  const now = new Date();
  let data: Prisma.TaskUpdateInput = {};
  const messages: { userId: number; type: 'TASK_SUBMITTED' | 'TASK_ACCEPTED' | 'TASK_REJECTED' | 'TASK_UPDATED'; title: string; body: string }[] = [];

  if (action === 'submit' || action === 'complete') {
    if (!(await canSubmitTask(user, task))) throw new HttpError(403, 'Нет прав отмечать выполнение');
    if (task.status === 'DONE') throw new HttpError(409, 'Задача уже выполнена');

    const needsAcceptance = task.acceptorId !== null && task.acceptorId !== user.id;
    if (needsAcceptance) {
      data = { status: 'PENDING_ACCEPTANCE', submittedAt: now };
      messages.push({
        userId: task.acceptorId!,
        type: 'TASK_SUBMITTED',
        title: 'Задача сдана на приёмку',
        body: `«${task.title}» — исполнитель ${task.assignee.fullName} отчитался о выполнении.`,
      });
    } else {
      data = { status: 'DONE', submittedAt: task.submittedAt ?? now, completedAt: now, isOverdue: false };
      messages.push({
        userId: task.customerId,
        type: 'TASK_ACCEPTED',
        title: 'Задача выполнена',
        body: `«${task.title}» отмечена как выполненная.`,
      });
    }
  } else if (action === 'accept') {
    if (!canAcceptTask(user, task)) throw new HttpError(403, 'Принять результат может только принимающий сотрудник');
    if (task.status !== 'PENDING_ACCEPTANCE') throw new HttpError(409, 'Задача не сдана на приёмку');
    data = { status: 'DONE', completedAt: now, acceptedAt: now, isOverdue: false };
    messages.push({
      userId: task.assigneeId,
      type: 'TASK_ACCEPTED',
      title: 'Результат принят',
      body: `«${task.title}» принята: ${user.fullName}.`,
    });
  } else if (action === 'reject') {
    if (!canAcceptTask(user, task)) throw new HttpError(403, 'Отклонить результат может только принимающий сотрудник');
    if (task.status !== 'PENDING_ACCEPTANCE') throw new HttpError(409, 'Задача не сдана на приёмку');
    data = { status: 'IN_PROGRESS', submittedAt: null, isOverdue: task.deadline < now };
    messages.push({
      userId: task.assigneeId,
      type: 'TASK_REJECTED',
      title: 'Результат возвращён на доработку',
      body: `«${task.title}»: ${comment?.trim() || 'без комментария'}.`,
    });
  } else if (action === 'reopen') {
    if (!(await canEditTask(user, task))) throw new HttpError(403, 'Нет прав возвращать задачу в работу');
    data = {
      status: 'IN_PROGRESS',
      completedAt: null,
      acceptedAt: null,
      submittedAt: null,
      cancelledAt: null,
      isOverdue: task.deadline < now,
    };
    messages.push({
      userId: task.assigneeId,
      type: 'TASK_UPDATED',
      title: 'Задача возвращена в работу',
      body: `«${task.title}» снова в работе.`,
    });
  } else {
    if (!(await canCancelTask(user, task))) throw new HttpError(403, 'Нет прав отменять задачу');
    data = { status: 'CANCELLED', cancelledAt: now, isOverdue: false };
    messages.push({
      userId: task.assigneeId,
      type: 'TASK_UPDATED',
      title: 'Задача отменена',
      body: `«${task.title}» отменена: ${user.fullName}.`,
    });
  }

  const updated = await prisma.task.update({ where: { id }, data, include: taskInclude });
  if (comment?.trim()) {
    await prisma.taskNote.create({ data: { taskId: id, authorId: user.id, body: comment.trim() } });
  }
  await logActivity(id, user.id, 'status_changed', { from: task.status, to: updated.status, action });
  await notify(
    messages.map((m) => ({ ...m, taskId: id })),
    user.id,
  );

  return updated;
}
