import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFindMany = vi.fn();
const taskFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => userFindMany(...a) },
    task: { findMany: (...a: unknown[]) => taskFindMany(...a) },
  },
}));
vi.mock('@/lib/telegram', () => ({
  telegramEnabled: () => false,
  sendTelegramMessage: vi.fn(),
  sendTelegramNotifications: vi.fn(),
}));

import { buildReportData } from '@/lib/jobs/reports';

const START = new Date('2026-09-04T19:00:00.000Z'); // начало суток в Ташкенте
const END = new Date('2026-09-05T18:59:59.999Z');
const NOW = new Date('2026-09-05T12:00:00.000Z');

const task = (over: Record<string, unknown>) => ({
  id: 1,
  title: 'Задача',
  priority: 'MEDIUM',
  assigneeId: 4,
  status: 'IN_PROGRESS',
  deadline: new Date('2026-09-05T13:00:00.000Z'),
  completedAt: null,
  assignee: { fullName: 'Олимбой' },
  customer: { fullName: 'Сухроб' },
  acceptor: null,
  ...over,
});

beforeEach(() => {
  userFindMany.mockReset();
  taskFindMany.mockReset();
  userFindMany.mockResolvedValue([{ id: 4, fullName: 'Олимбой', position: 'Бухгалтер' }]);
});

describe('сводка по сотруднику', () => {
  it('считает выполненное, просроченное и перенесённое', async () => {
    taskFindMany.mockResolvedValue([
      // выполнена сегодня
      task({ id: 1, status: 'DONE', completedAt: new Date('2026-09-05T10:00:00.000Z') }),
      // в работе, срок сегодня
      task({ id: 2 }),
      // хвост с прошлого дня — и перенесённая, и просроченная
      task({ id: 3, deadline: new Date('2026-09-02T10:00:00.000Z') }),
      // сдана на приёмку
      task({ id: 4, status: 'PENDING_ACCEPTANCE' }),
    ]);

    const { items, totals } = await buildReportData([4], START, END, NOW);
    const mine = items[0];
    expect(mine.planned).toBe(4);
    expect(mine.completed).toBe(1);
    expect(mine.pending).toBe(1);
    expect(mine.overdue).toBe(1);
    expect(mine.carriedOver).toBe(1);
    expect(totals).toMatchObject({ planned: 4, completed: 1, overdue: 1 });
  });

  it('в список незакрытых попадают только открытые задачи, по сроку', async () => {
    taskFindMany.mockResolvedValue([
      task({ id: 1, title: 'Поздняя', deadline: new Date('2026-09-05T17:00:00.000Z') }),
      task({ id: 2, title: 'Ранняя', deadline: new Date('2026-09-02T10:00:00.000Z') }),
      task({ id: 3, title: 'Закрытая', status: 'DONE', completedAt: NOW }),
    ]);
    const { items } = await buildReportData([4], START, END, NOW);
    expect(items[0].unfinished.map((t) => t.title)).toEqual(['Ранняя', 'Поздняя']);
    expect(items[0].unfinished[0]).toMatchObject({ overdue: true, customer: 'Сухроб' });
  });

  it('выполненное вне периода не засчитывается', async () => {
    taskFindMany.mockResolvedValue([
      task({ id: 1, status: 'DONE', completedAt: new Date('2026-09-01T10:00:00.000Z') }),
    ]);
    const { items } = await buildReportData([4], START, END, NOW);
    expect(items[0].completed).toBe(0);
  });

  it('пустой список сотрудников не ходит в базу', async () => {
    const { items, totals } = await buildReportData([], START, END, NOW);
    expect(items).toEqual([]);
    expect(totals.planned).toBe(0);
    expect(taskFindMany).not.toHaveBeenCalled();
  });
});
