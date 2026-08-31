import 'server-only';
import type { Prisma, Task } from '@prisma/client';
import { prisma } from './db';
import type { SessionUser } from './auth';

export type TaskLike = Pick<
  Task,
  'id' | 'assigneeId' | 'customerId' | 'acceptorId' | 'createdById' | 'departmentId' | 'status'
>;

export const ROLE_LABELS: Record<SessionUser['role'], string> = {
  ADMIN: 'Администратор',
  DIRECTOR: 'Директор',
  CHIEF_ACCOUNTANT: 'Главный бухгалтер',
  ACCOUNTANT: 'Бухгалтер / оператор',
};

export function isDirector(user: SessionUser) {
  return user.role === 'DIRECTOR';
}

export function isChief(user: SessionUser) {
  return user.role === 'CHIEF_ACCOUNTANT';
}

export function isAdmin(user: SessionUser) {
  return user.role === 'ADMIN';
}

/** Руководитель получает отчёты и видит чужие задачи. */
export function isManager(user: SessionUser) {
  return isDirector(user) || isChief(user);
}

/**
 * Идентификаторы сотрудников, чьи задачи пользователь вправе видеть.
 * Для главбуха — свой отдел (по departmentId) плюс прямые подчинённые (managerId).
 */
export async function subordinateIds(user: SessionUser): Promise<number[]> {
  if (!isChief(user)) return [];
  const where: Prisma.UserWhereInput[] = [{ managerId: user.id }];
  if (user.departmentId) where.push({ departmentId: user.departmentId });
  const users = await prisma.user.findMany({
    where: { OR: where, NOT: { id: user.id } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Кому пользователь может назначить задачу (включая себя). */
export async function assignableUserIds(user: SessionUser): Promise<number[] | 'ALL'> {
  if (isDirector(user)) return 'ALL';
  if (isChief(user)) return [user.id, ...(await subordinateIds(user))];
  if (isAdmin(user)) return [];
  return [user.id];
}

/** Prisma-фильтр «какие задачи видит этот пользователь». */
export async function visibleTasksFilter(user: SessionUser): Promise<Prisma.TaskWhereInput> {
  if (isDirector(user)) return {};
  if (isAdmin(user)) return { id: -1 }; // администратор работает только с учётными записями
  if (isChief(user)) {
    const ids = [user.id, ...(await subordinateIds(user))];
    return {
      OR: [
        { assigneeId: { in: ids } },
        { customerId: { in: ids } },
        { customerId: user.id },
        { acceptorId: user.id },
        { createdById: user.id },
        ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
      ],
    };
  }
  return {
    OR: [{ assigneeId: user.id }, { customerId: user.id }, { acceptorId: user.id }],
  };
}

async function inScope(user: SessionUser, task: TaskLike) {
  if (isChief(user)) {
    const ids = [user.id, ...(await subordinateIds(user))];
    return (
      ids.includes(task.assigneeId) ||
      ids.includes(task.customerId) ||
      (task.departmentId !== null && task.departmentId === user.departmentId)
    );
  }
  return false;
}

function isParticipant(user: SessionUser, task: TaskLike) {
  return (
    task.assigneeId === user.id ||
    task.customerId === user.id ||
    task.acceptorId === user.id ||
    task.createdById === user.id
  );
}

export async function canViewTask(user: SessionUser, task: TaskLike) {
  if (isDirector(user)) return true;
  if (isAdmin(user)) return false;
  return isParticipant(user, task) || (await inScope(user, task));
}

/** Правка полей задачи (название, описание, дедлайн, приоритет, участники). */
export async function canEditTask(user: SessionUser, task: TaskLike) {
  if (isAdmin(user)) return false;
  if (isDirector(user)) return task.createdById === user.id; // директор правит только созданное им
  if (isChief(user)) return (await inScope(user, task)) || isParticipant(user, task);
  // Бухгалтер правит задачу, если он исполнитель или сам её создал
  return task.assigneeId === user.id || task.createdById === user.id;
}

/** Заметки и вложения — любой участник задачи (и руководитель в своей зоне). */
export async function canCommentTask(user: SessionUser, task: TaskLike) {
  if (isAdmin(user)) return false;
  if (isDirector(user)) return true;
  return isParticipant(user, task) || (await inScope(user, task));
}

/** Отметить выполнение (сдать результат) может исполнитель или его руководитель. */
export async function canSubmitTask(user: SessionUser, task: TaskLike) {
  if (isAdmin(user) || isDirector(user)) return false;
  if (task.assigneeId === user.id) return true;
  return isChief(user) && (await inScope(user, task));
}

/** Принять результат: назначенный принимающий, а если его нет — заказчик. */
export function canAcceptTask(user: SessionUser, task: TaskLike) {
  if (task.acceptorId) return task.acceptorId === user.id;
  return task.customerId === user.id;
}

export async function canCancelTask(user: SessionUser, task: TaskLike) {
  if (isAdmin(user)) return false;
  if (isDirector(user)) return task.createdById === user.id;
  if (isChief(user)) return (await inScope(user, task)) || isParticipant(user, task);
  return task.createdById === user.id && task.assigneeId === user.id;
}

export async function canDeleteTask(user: SessionUser, task: TaskLike) {
  // Полное удаление — только автор-руководитель: история задач ценнее, обычно нужна отмена.
  if (isDirector(user)) return task.createdById === user.id;
  if (isChief(user)) return task.createdById === user.id;
  return false;
}

export async function canAssignTo(user: SessionUser, assigneeId: number) {
  const allowed = await assignableUserIds(user);
  return allowed === 'ALL' || allowed.includes(assigneeId);
}

/** Отделы, по которым пользователь вправе смотреть отчёты. */
export async function reportScope(
  user: SessionUser,
): Promise<{ all: true } | { departmentIds: number[] } | null> {
  if (isDirector(user)) return { all: true };
  if (isChief(user)) return { departmentIds: user.departmentId ? [user.departmentId] : [] };
  return null;
}

export function canManageUsers(user: SessionUser) {
  return isAdmin(user);
}
