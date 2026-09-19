import { beforeEach, describe, expect, it, vi } from 'vitest';

// Права главбуха зависят от состава отдела — подменяем обращение к базе
const findMany = vi.fn();
vi.mock('@/lib/db', () => ({ prisma: { user: { findMany: (...args: unknown[]) => findMany(...args) } } }));

import type { SessionUser } from '@/lib/auth';
import {
  assignableUserIds,
  canAcceptTask,
  canCommentTask,
  canDeleteTask,
  canEditTask,
  canManageDepartments,
  canManageUsers,
  canSubmitTask,
  canViewTask,
  visibleTasksFilter,
  type TaskLike,
} from '@/lib/permissions';

const user = (over: Partial<SessionUser> & Pick<SessionUser, 'id' | 'role'>): SessionUser => ({
  email: 'x@company.ru',
  fullName: 'Тест',
  departmentId: 1,
  departmentName: 'Бухгалтерия',
  managerId: null,
  ...over,
});

const admin = user({ id: 1, role: 'ADMIN', departmentId: null });
const director = user({ id: 2, role: 'DIRECTOR', departmentId: null });
const chief = user({ id: 3, role: 'CHIEF_ACCOUNTANT' });
const worker = user({ id: 4, role: 'ACCOUNTANT' });
const outsider = user({ id: 9, role: 'ACCOUNTANT', departmentId: 2 });

const task = (over: Partial<TaskLike> = {}): TaskLike => ({
  id: 100,
  assigneeId: 4,
  customerId: 3,
  acceptorId: 3,
  createdById: 3,
  departmentId: 1,
  status: 'IN_PROGRESS',
  coAssignees: [],
  ...over,
});

beforeEach(() => {
  findMany.mockReset();
  // подчинённые главбуха: сотрудник №4
  findMany.mockResolvedValue([{ id: 4 }]);
});

describe('видимость задач', () => {
  it('директор видит всё, администратор — ничего', async () => {
    expect(await visibleTasksFilter(director)).toEqual({});
    expect(await visibleTasksFilter(admin)).toEqual({ id: -1 });
  });

  it('сотрудник видит только задачи со своим участием', async () => {
    expect(await canViewTask(worker, task())).toBe(true);
    expect(await canViewTask(worker, task({ assigneeId: 7, customerId: 7, acceptorId: 7, createdById: 7 }))).toBe(false);
  });

  it('со-исполнитель видит задачу', async () => {
    const shared = task({ assigneeId: 7, customerId: 7, acceptorId: 7, createdById: 7, coAssignees: [{ userId: 4 }] });
    expect(await canViewTask(worker, shared)).toBe(true);
  });

  it('главбух видит задачи своего отдела, но не чужого', async () => {
    expect(await canViewTask(chief, task({ assigneeId: 4, customerId: 9, acceptorId: null, createdById: 9 }))).toBe(true);
    expect(
      await canViewTask(chief, task({ assigneeId: 9, customerId: 9, acceptorId: null, createdById: 9, departmentId: 2 })),
    ).toBe(false);
  });

  it('администратор не видит чужие задачи', async () => {
    expect(await canViewTask(admin, task())).toBe(false);
  });
});

describe('выполнение и приёмка', () => {
  it('отмечать выполнение может исполнитель и со-исполнитель', async () => {
    expect(await canSubmitTask(worker, task())).toBe(true);
    const shared = task({ assigneeId: 7, coAssignees: [{ userId: 4 }] });
    expect(await canSubmitTask(worker, shared)).toBe(true);
  });

  it('директор не закрывает чужие задачи', async () => {
    expect(await canSubmitTask(director, task())).toBe(false);
  });

  it('посторонний не может отметить выполнение', async () => {
    expect(await canSubmitTask(outsider, task())).toBe(false);
  });

  it('принимает назначенный принимающий', () => {
    expect(canAcceptTask(chief, task())).toBe(true);
    expect(canAcceptTask(worker, task())).toBe(false);
  });

  it('без принимающего результат принимает заказчик', () => {
    expect(canAcceptTask(chief, task({ acceptorId: null }))).toBe(true);
    expect(canAcceptTask(worker, task({ acceptorId: null, customerId: 3 }))).toBe(false);
  });
});

describe('правка и удаление', () => {
  it('директор правит только созданное им', async () => {
    expect(await canEditTask(director, task({ createdById: 2 }))).toBe(true);
    expect(await canEditTask(director, task({ createdById: 3 }))).toBe(false);
  });

  it('исполнитель правит свою задачу, посторонний — нет', async () => {
    expect(await canEditTask(worker, task())).toBe(true);
    expect(await canEditTask(outsider, task())).toBe(false);
  });

  it('удалять может только автор-руководитель', async () => {
    expect(await canDeleteTask(chief, task({ createdById: 3 }))).toBe(true);
    expect(await canDeleteTask(chief, task({ createdById: 9 }))).toBe(false);
    expect(await canDeleteTask(worker, task({ createdById: 4 }))).toBe(false);
  });

  it('заметки доступны участникам, но не посторонним', async () => {
    expect(await canCommentTask(worker, task())).toBe(true);
    expect(await canCommentTask(outsider, task())).toBe(false);
    expect(await canCommentTask(admin, task())).toBe(false);
  });
});

describe('назначение и администрирование', () => {
  it('задачу можно поставить любому — отделы работают друг с другом', async () => {
    expect(await assignableUserIds(worker)).toBe('ALL');
    expect(await assignableUserIds(director)).toBe('ALL');
    expect(await assignableUserIds(admin)).toEqual([]);
  });

  it('учётные записи ведёт только администратор', () => {
    expect(canManageUsers(admin)).toBe(true);
    expect(canManageUsers(director)).toBe(false);
  });

  it('отделы заводит администратор или директор', () => {
    expect(canManageDepartments(admin)).toBe(true);
    expect(canManageDepartments(director)).toBe(true);
    expect(canManageDepartments(chief)).toBe(false);
  });
});
