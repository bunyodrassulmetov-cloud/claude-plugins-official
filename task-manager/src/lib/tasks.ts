import 'server-only';
import type { Prisma, TaskStatus } from '@prisma/client';
import { prisma } from './db';
import type { SessionUser } from './auth';
import { visibleTasksFilter } from './permissions';
import { dayBounds } from './dates';
import { getSettings } from './settings';

export const taskInclude = {
  assignee: { select: { id: true, fullName: true, email: true } },
  customer: { select: { id: true, fullName: true, email: true } },
  acceptor: { select: { id: true, fullName: true, email: true } },
  department: { select: { id: true, name: true } },
  _count: { select: { attachments: true, notes: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export const OPEN_STATUSES: TaskStatus[] = ['IN_PROGRESS', 'PENDING_ACCEPTANCE'];

export type TaskFilters = {
  view?: 'today' | 'all' | 'overdue' | 'archive';
  status?: TaskStatus;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assigneeId?: number;
  departmentId?: number;
  from?: Date;
  to?: Date;
  search?: string;
  onlyMine?: boolean;
};

/**
 * «Мои задачи на сегодня» = задачи с дедлайном сегодня
 *  + все незакрытые задачи с истёкшим дедлайном за прошлые дни.
 * Ничего не переносится физически — окно вычисляется на чтении,
 * поэтому задачи не дублируются и не теряются.
 */
export function todayWindowFilter(now: Date, timezone: string): Prisma.TaskWhereInput {
  const { start, end } = dayBounds(now, timezone);
  return {
    OR: [
      { deadline: { gte: start, lte: end } },
      { deadline: { lt: start }, status: { in: OPEN_STATUSES } },
    ],
  };
}

export async function buildTaskWhere(
  user: SessionUser,
  filters: TaskFilters,
  now = new Date(),
): Promise<Prisma.TaskWhereInput> {
  const { timezone } = await getSettings();
  const and: Prisma.TaskWhereInput[] = [await visibleTasksFilter(user)];

  if (filters.onlyMine) and.push({ assigneeId: user.id });
  if (filters.view === 'today') and.push(todayWindowFilter(now, timezone));
  if (filters.view === 'overdue') {
    and.push({ deadline: { lt: now }, status: { in: OPEN_STATUSES } });
  }
  if (filters.view === 'archive') and.push({ status: { in: ['DONE', 'CANCELLED'] } });
  if (filters.status) and.push({ status: filters.status });
  if (filters.priority) and.push({ priority: filters.priority });
  if (filters.assigneeId) and.push({ assigneeId: filters.assigneeId });
  if (filters.departmentId) and.push({ departmentId: filters.departmentId });
  if (filters.from) and.push({ deadline: { gte: filters.from } });
  if (filters.to) and.push({ deadline: { lte: filters.to } });
  if (filters.search) {
    and.push({
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }
  return { AND: and };
}

export async function listTasks(user: SessionUser, filters: TaskFilters, take = 200) {
  const where = await buildTaskWhere(user, filters);
  return prisma.task.findMany({
    where,
    include: taskInclude,
    orderBy: [{ status: 'asc' }, { deadline: 'asc' }, { priority: 'desc' }],
    take,
  });
}

/** Просрочка вычисляется на лету: флаг в БД обновляет cron, но список должен быть точным всегда. */
export function isTaskOverdue(task: { deadline: Date; status: TaskStatus }, now = new Date()) {
  return OPEN_STATUSES.includes(task.status) && task.deadline.getTime() < now.getTime();
}

/** Разбиение списка на блоки дашборда. */
export function groupTasks(tasks: TaskWithRelations[], now = new Date(), timezone = 'UTC') {
  const { start, end } = dayBounds(now, timezone);
  const overdue: TaskWithRelations[] = [];
  const today: TaskWithRelations[] = [];
  const upcoming: TaskWithRelations[] = [];
  const done: TaskWithRelations[] = [];

  for (const task of tasks) {
    if (task.status === 'DONE' || task.status === 'CANCELLED') {
      done.push(task);
    } else if (isTaskOverdue(task, now)) {
      overdue.push(task);
    } else if (task.deadline >= start && task.deadline <= end) {
      today.push(task);
    } else {
      upcoming.push(task);
    }
  }
  return { overdue, today, upcoming, done };
}

export async function logActivity(
  taskId: number,
  actorId: number | null,
  action: string,
  details?: Prisma.InputJsonValue,
) {
  await prisma.taskActivity.create({ data: { taskId, actorId, action, details } });
}
