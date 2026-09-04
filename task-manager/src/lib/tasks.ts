import 'server-only';
import type { Prisma, Priority, TaskStatus } from '@prisma/client';
import { prisma } from './db';
import type { SessionUser } from './auth';
import { visibleTasksFilter } from './permissions';
import { dayBounds, formatDateTime, humanizeDeadline } from './dates';
import { getSettings } from './settings';

export const taskInclude = {
  // email намеренно не выбираем: в интерфейсе задач он не нужен
  assignee: { select: { id: true, fullName: true } },
  customer: { select: { id: true, fullName: true } },
  acceptor: { select: { id: true, fullName: true } },
  department: { select: { id: true, name: true } },
  coAssignees: { select: { userId: true, user: { select: { id: true, fullName: true } } } },
  // Пункты чек-листа нужны только для счётчика «сделано из всего» в списке
  checklist: { select: { id: true, isDone: true } },
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

/** Данные одной строки списка: всё уже отформатировано на сервере,
 *  чтобы клиентский компонент не зависел от часового пояса браузера. */
export type TaskRowData = {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  assignee: string;
  customer: string;
  acceptor: string | null;
  coAssignees: string[];
  department: string | null;
  deadlineText: string;
  deadlineHuman: string;
  overdue: boolean;
  closed: boolean;
  completedText: string | null;
  attachments: number;
  notes: number;
  checklistDone: number;
  checklistTotal: number;
  carryOverDays: number;
  /** Быстрые действия в строке: считаются на сервере по тем же правилам, что и внутри задачи. */
  canSubmit: boolean;
  canAccept: boolean;
  canPostpone: boolean;
  hasAcceptor: boolean;
};

export function toRowData(
  task: TaskWithRelations,
  timezone: string,
  now = new Date(),
  abilities: { canSubmit?: boolean; canAccept?: boolean; canPostpone?: boolean } = {},
): TaskRowData {
  const closed = task.status === 'DONE' || task.status === 'CANCELLED';
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    assignee: task.assignee.fullName,
    customer: task.customer.fullName,
    acceptor: task.acceptor?.fullName ?? null,
    coAssignees: task.coAssignees.map((item) => item.user.fullName),
    department: task.department?.name ?? null,
    deadlineText: formatDateTime(task.deadline, timezone),
    deadlineHuman: humanizeDeadline(task.deadline, now),
    overdue: isTaskOverdue(task, now),
    closed,
    completedText: task.completedAt ? formatDateTime(task.completedAt, timezone) : null,
    attachments: task._count.attachments,
    notes: task._count.notes,
    checklistDone: task.checklist.filter((item) => item.isDone).length,
    checklistTotal: task.checklist.length,
    carryOverDays: task.carryOverDays,
    canSubmit: Boolean(abilities.canSubmit) && task.status === 'IN_PROGRESS',
    canAccept: Boolean(abilities.canAccept) && task.status === 'PENDING_ACCEPTANCE',
    canPostpone: Boolean(abilities.canPostpone) && !closed,
    hasAcceptor: task.acceptorId !== null,
  };
}

/** Считает права на быстрые действия для списка задач одним проходом. */
export async function withRowAbilities(
  user: SessionUser,
  tasks: TaskWithRelations[],
  timezone: string,
  now = new Date(),
) {
  const { canAcceptTask, canEditTask, canSubmitTask } = await import('./permissions');
  return Promise.all(
    tasks.map(async (task) =>
      toRowData(task, timezone, now, {
        canSubmit: await canSubmitTask(user, task),
        canAccept: canAcceptTask(user, task),
        canPostpone: await canEditTask(user, task),
      }),
    ),
  );
}

export async function logActivity(
  taskId: number,
  actorId: number | null,
  action: string,
  details?: Prisma.InputJsonValue,
) {
  await prisma.taskActivity.create({ data: { taskId, actorId, action, details } });
}
