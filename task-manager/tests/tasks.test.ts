import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: { user: { findMany: vi.fn().mockResolvedValue([]) } } }));

import { groupTasks, isTaskOverdue, toRowData, todayWindowFilter, type TaskWithRelations } from '@/lib/tasks';

const TZ = 'Asia/Tashkent';
const NOW = new Date('2026-09-04T12:00:00.000Z'); // 17:00 в Ташкенте

const person = (id: number, fullName: string) => ({ id, fullName });

const make = (over: Partial<TaskWithRelations> = {}): TaskWithRelations =>
  ({
    id: 1,
    title: 'Задача',
    description: null,
    assigneeId: 4,
    customerId: 3,
    acceptorId: null,
    createdById: 3,
    departmentId: 1,
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    deadline: new Date('2026-09-04T13:00:00.000Z'),
    isOverdue: false,
    overdueSince: null,
    carryOverDays: 0,
    submittedAt: null,
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    assignee: person(4, 'Олимбой'),
    customer: person(3, 'Сухроб'),
    acceptor: null,
    department: { id: 1, name: 'Бухгалтерия' },
    coAssignees: [],
    checklist: [],
    _count: { attachments: 0, notes: 0 },
    ...over,
  }) as TaskWithRelations;

describe('просрочка', () => {
  it('открытая задача с истёкшим сроком просрочена', () => {
    expect(isTaskOverdue(make({ deadline: new Date('2026-09-03T10:00:00.000Z') }), NOW)).toBe(true);
  });

  it('выполненная задача не считается просроченной', () => {
    const done = make({ deadline: new Date('2026-09-03T10:00:00.000Z'), status: 'DONE' });
    expect(isTaskOverdue(done, NOW)).toBe(false);
  });

  it('отменённая задача не считается просроченной', () => {
    const cancelled = make({ deadline: new Date('2026-09-01T10:00:00.000Z'), status: 'CANCELLED' });
    expect(isTaskOverdue(cancelled, NOW)).toBe(false);
  });

  it('задача на приёмке с истёкшим сроком всё ещё просрочена', () => {
    const pending = make({ deadline: new Date('2026-09-03T10:00:00.000Z'), status: 'PENDING_ACCEPTANCE' });
    expect(isTaskOverdue(pending, NOW)).toBe(true);
  });
});

describe('окно текущего дня', () => {
  it('берёт задачи на сегодня и незакрытые хвосты прошлых дней', () => {
    const filter = todayWindowFilter(NOW, TZ);
    expect(filter.OR).toHaveLength(2);
    const [today, tails] = filter.OR as Array<Record<string, unknown>>;
    expect(today).toHaveProperty('deadline');
    expect(tails).toMatchObject({ status: { in: ['IN_PROGRESS', 'PENDING_ACCEPTANCE'] } });
  });
});

describe('группировка списка', () => {
  const tasks = [
    make({ id: 1, deadline: new Date('2026-09-02T10:00:00.000Z') }), // просрочена
    make({ id: 2, deadline: new Date('2026-09-04T15:00:00.000Z') }), // сегодня
    make({ id: 3, deadline: new Date('2026-09-10T10:00:00.000Z') }), // позже
    make({ id: 4, status: 'DONE', completedAt: NOW }), // закрыта
    make({ id: 5, status: 'CANCELLED' }), // отменена
  ];

  it('раскладывает задачи по блокам дашборда', () => {
    const { overdue, today, upcoming, done } = groupTasks(tasks, NOW, TZ);
    expect(overdue.map((t) => t.id)).toEqual([1]);
    expect(today.map((t) => t.id)).toEqual([2]);
    expect(upcoming.map((t) => t.id)).toEqual([3]);
    expect(done.map((t) => t.id)).toEqual([4, 5]);
  });
});

describe('строка списка', () => {
  it('готовит подписи и флаги для интерфейса', () => {
    const row = toRowData(
      make({
        deadline: new Date('2026-09-02T10:00:00.000Z'),
        carryOverDays: 2,
        coAssignees: [{ userId: 5, user: person(5, 'Шохрух') }],
        checklist: [{ id: 1, isDone: true }, { id: 2, isDone: false }],
      }) as TaskWithRelations,
      TZ,
      NOW,
      { canSubmit: true, canAccept: true, canPostpone: true },
    );
    expect(row.overdue).toBe(true);
    expect(row.closed).toBe(false);
    expect(row.deadlineText).toBe('02.09.2026 15:00');
    expect(row.deadlineShort).toBe('02.09 15:00');
    expect(row.coAssignees).toEqual(['Шохрух']);
    expect(row.checklistDone).toBe(1);
    expect(row.checklistTotal).toBe(2);
    expect(row.canSubmit).toBe(true);
    // приёмка доступна только для задачи, сданной на проверку
    expect(row.canAccept).toBe(false);
  });

  it('у закрытой задачи нет быстрых действий', () => {
    const row = toRowData(make({ status: 'DONE', completedAt: NOW }), TZ, NOW, {
      canSubmit: true,
      canPostpone: true,
    });
    expect(row.closed).toBe(true);
    expect(row.canSubmit).toBe(false);
    expect(row.canPostpone).toBe(false);
  });
});
