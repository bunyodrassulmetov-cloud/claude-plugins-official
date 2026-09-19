import 'server-only';
import { prisma } from './db';
import type { SessionUser } from './auth';
import { isChief, subordinateIds } from './permissions';
import { dayBounds } from './dates';
import { OPEN_STATUSES } from './tasks';
import { formatInTimeZone } from 'date-fns-tz';

export type WeekPoint = { label: string; onTime: number; late: number };
export type PersonRow = { userId: number; name: string; onTime: number; late: number; openOverdue: number };

export type Analytics = {
  weeks: WeekPoint[];
  people: PersonRow[];
  totals: { completed: number; onTime: number; late: number; openOverdue: number; onTimeShare: number };
};

/** Понедельник недели, в которую попадает дата, в рабочем часовом поясе. */
function weekStart(date: Date, timezone: string) {
  const weekday = Number(formatInTimeZone(date, timezone, 'i')); // 1 — пн
  const shifted = new Date(date.getTime() - (weekday - 1) * 86_400_000);
  return dayBounds(shifted, timezone).start;
}

/**
 * Сводная статистика для руководителя: выполнено в срок и с опозданием
 * по неделям и по сотрудникам. Считается из закрытых задач за период.
 */
export async function loadAnalytics(
  user: SessionUser,
  weeks: number,
  timezone: string,
  now = new Date(),
): Promise<Analytics> {
  const staffIds = isChief(user)
    ? await subordinateIds(user)
    : (
        await prisma.user.findMany({
          where: { isActive: true, approvalStatus: 'APPROVED', role: { in: ['CHIEF_ACCOUNTANT', 'ACCOUNTANT'] } },
          select: { id: true },
        })
      ).map((person) => person.id);

  if (staffIds.length === 0) {
    return { weeks: [], people: [], totals: { completed: 0, onTime: 0, late: 0, openOverdue: 0, onTimeShare: 0 } };
  }

  const currentWeek = weekStart(now, timezone);
  const from = new Date(currentWeek.getTime() - (weeks - 1) * 7 * 86_400_000);

  const [completed, openOverdue, staff] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: { in: staffIds }, status: 'DONE', completedAt: { gte: from } },
      select: { assigneeId: true, deadline: true, completedAt: true },
    }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { assigneeId: { in: staffIds }, status: { in: OPEN_STATUSES }, deadline: { lt: now } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  // Недельные столбцы: пустые недели тоже нужны, иначе график врёт о ритме
  const buckets = new Map<number, WeekPoint>();
  for (let i = 0; i < weeks; i += 1) {
    const start = new Date(from.getTime() + i * 7 * 86_400_000);
    buckets.set(start.getTime(), {
      label: formatInTimeZone(start, timezone, 'dd.MM'),
      onTime: 0,
      late: 0,
    });
  }

  const byPerson = new Map<number, PersonRow>(
    staff.map((person) => [
      person.id,
      { userId: person.id, name: person.fullName, onTime: 0, late: 0, openOverdue: 0 },
    ]),
  );
  for (const row of openOverdue) {
    const person = row.assigneeId !== null ? byPerson.get(row.assigneeId) : undefined;
    if (person) person.openOverdue = row._count._all;
  }

  let onTime = 0;
  let late = 0;
  for (const task of completed) {
    if (!task.completedAt) continue;
    const inTime = task.completedAt <= task.deadline;
    const bucket = buckets.get(weekStart(task.completedAt, timezone).getTime());
    if (bucket) {
      if (inTime) bucket.onTime += 1;
      else bucket.late += 1;
    }
    const person = byPerson.get(task.assigneeId);
    if (person) {
      if (inTime) person.onTime += 1;
      else person.late += 1;
    }
    if (inTime) onTime += 1;
    else late += 1;
  }

  const completedTotal = onTime + late;
  return {
    weeks: Array.from(buckets.values()),
    people: Array.from(byPerson.values()).sort(
      (a, b) => b.late + b.openOverdue - (a.late + a.openOverdue) || a.name.localeCompare(b.name),
    ),
    totals: {
      completed: completedTotal,
      onTime,
      late,
      openOverdue: openOverdue.reduce((sum, row) => sum + row._count._all, 0),
      onTimeShare: completedTotal === 0 ? 0 : Math.round((onTime / completedTotal) * 100),
    },
  };
}
