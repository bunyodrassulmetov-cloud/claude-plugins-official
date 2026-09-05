import 'server-only';
import type { Prisma, ReportPeriod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { OPEN_STATUSES } from '@/lib/tasks';
import { periodBounds } from '@/lib/dates';
import { getSettings } from '@/lib/settings';
import { notify } from '@/lib/notifications';
import { sendTelegramMessage, telegramEnabled } from '@/lib/telegram';

export type UnfinishedTask = {
  id: number;
  title: string;
  priority: string;
  deadline: string;
  assignee: string;
  customer: string;
  acceptor: string | null;
  overdue: boolean;
};

export type ReportTotals = {
  planned: number;
  completed: number;
  pending: number;
  overdue: number;
  carriedOver: number;
};

/**
 * Считает сводку по сотрудникам за период.
 * «Запланировано» = задачи с дедлайном внутри периода плюс незакрытые хвосты
 * с более ранним дедлайном — ровно то, что сотрудник видел в своём списке.
 */
export async function buildReportData(
  userIds: number[],
  periodStart: Date,
  periodEnd: Date,
  now = new Date(),
) {
  if (userIds.length === 0) return { totals: emptyTotals(), items: [] };

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true, position: true },
    orderBy: { fullName: 'asc' },
  });

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: { in: userIds },
      OR: [
        { deadline: { gte: periodStart, lte: periodEnd } },
        { deadline: { lt: periodStart }, status: { in: OPEN_STATUSES } },
        { completedAt: { gte: periodStart, lte: periodEnd } },
      ],
    },
    include: {
      assignee: { select: { fullName: true } },
      customer: { select: { fullName: true } },
      acceptor: { select: { fullName: true } },
    },
  });

  const items = users.map((user) => {
    const own = tasks.filter((t) => t.assigneeId === user.id);
    const completed = own.filter(
      (t) => t.status === 'DONE' && t.completedAt && t.completedAt >= periodStart && t.completedAt <= periodEnd,
    );
    const pending = own.filter((t) => t.status === 'PENDING_ACCEPTANCE');
    const open = own.filter((t) => OPEN_STATUSES.includes(t.status));
    const overdue = open.filter((t) => t.deadline < now);
    const carriedOver = open.filter((t) => t.deadline < periodStart);
    const planned = own.filter(
      (t) =>
        (t.deadline >= periodStart && t.deadline <= periodEnd) ||
        (t.deadline < periodStart && OPEN_STATUSES.includes(t.status)),
    );

    const unfinished: UnfinishedTask[] = open
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        deadline: t.deadline.toISOString(),
        assignee: t.assignee.fullName,
        customer: t.customer.fullName,
        acceptor: t.acceptor?.fullName ?? null,
        overdue: t.deadline < now,
      }));

    return {
      userId: user.id,
      userName: user.fullName,
      position: user.position,
      planned: planned.length,
      completed: completed.length,
      pending: pending.length,
      overdue: overdue.length,
      carriedOver: carriedOver.length,
      unfinished,
    };
  });

  const totals = items.reduce<ReportTotals>(
    (acc, item) => ({
      planned: acc.planned + item.planned,
      completed: acc.completed + item.completed,
      pending: acc.pending + item.pending,
      overdue: acc.overdue + item.overdue,
      carriedOver: acc.carriedOver + item.carriedOver,
    }),
    emptyTotals(),
  );

  return { totals, items };
}

function emptyTotals(): ReportTotals {
  return { planned: 0, completed: 0, pending: 0, overdue: 0, carriedOver: 0 };
}

/** Сохраняет отчёт (идемпотентно: повторный запуск за тот же период перезаписывает). */
export async function persistReport(params: {
  periodType: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  departmentId: number | null;
  recipientId: number;
  userIds: number[];
  now?: Date;
}) {
  const { totals, items } = await buildReportData(
    params.userIds,
    params.periodStart,
    params.periodEnd,
    params.now,
  );

  const report = await prisma.report.upsert({
    where: {
      recipientId_periodType_periodStart: {
        recipientId: params.recipientId,
        periodType: params.periodType,
        periodStart: params.periodStart,
      },
    },
    update: {
      periodEnd: params.periodEnd,
      departmentId: params.departmentId,
      generatedAt: new Date(),
      totals: totals as unknown as Prisma.InputJsonValue,
    },
    create: {
      periodType: params.periodType,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      departmentId: params.departmentId,
      recipientId: params.recipientId,
      totals: totals as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.reportItem.deleteMany({ where: { reportId: report.id } });
  if (items.length > 0) {
    await prisma.reportItem.createMany({
      data: items.map((item) => ({
        reportId: report.id,
        userId: item.userId,
        planned: item.planned,
        completed: item.completed,
        pending: item.pending,
        overdue: item.overdue,
        carriedOver: item.carriedOver,
        unfinished: item.unfinished as unknown as Prisma.InputJsonValue,
      })),
    });
  }

  return report;
}

/**
 * Ежедневные отчёты: главбуху — по его отделу, директору — по всей компании.
 * Вызывается cron-джобом в конце рабочего дня.
 */
export async function generateDailyReports(now = new Date(), periodType: ReportPeriod = 'DAILY') {
  const { timezone } = await getSettings();
  const { start, end } = periodBounds(periodType, now, timezone);
  const created: number[] = [];

  const departments = await prisma.department.findMany({
    include: { members: { where: { isActive: true }, select: { id: true, role: true } } },
  });

  for (const department of departments) {
    if (!department.headId) continue;
    const userIds = department.members.filter((m) => m.id !== department.headId).map((m) => m.id);
    const report = await persistReport({
      periodType,
      periodStart: start,
      periodEnd: end,
      departmentId: department.id,
      recipientId: department.headId,
      userIds,
      now,
    });
    created.push(report.id);
    await notify({
      userId: department.headId,
      type: 'REPORT_READY',
      title: 'Готов отчёт по отделу',
      body: `Сводка «${department.name}» за период сформирована — раздел «Отчёты».`,
    });
  }

  const directors = await prisma.user.findMany({
    where: { role: 'DIRECTOR', isActive: true },
    select: { id: true },
  });
  if (directors.length > 0) {
    const staff = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['CHIEF_ACCOUNTANT', 'ACCOUNTANT'] } },
      select: { id: true },
    });
    for (const director of directors) {
      const report = await persistReport({
        periodType,
        periodStart: start,
        periodEnd: end,
        departmentId: null,
        recipientId: director.id,
        userIds: staff.map((u) => u.id),
        now,
      });
      created.push(report.id);
      await notify({
        userId: director.id,
        type: 'REPORT_READY',
        title: 'Готова сводка по компании',
        body: 'Отчёт за период доступен в разделе «Отчёты».',
      });
    }
  }

  const personal = await sendPersonalSummaries(start, end, now);
  return { reports: created.length, personalSummaries: personal, periodStart: start, periodEnd: end };
}

/**
 * Итог дня каждому сотруднику в Telegram: та же сводка, что видит руководитель,
 * но только по нему самому. Без привязанного чата шаг пропускается.
 */
async function sendPersonalSummaries(periodStart: Date, periodEnd: Date, now: Date) {
  if (!telegramEnabled()) return 0;

  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      approvalStatus: 'APPROVED',
      telegramChatId: { not: null },
      role: { in: ['CHIEF_ACCOUNTANT', 'ACCOUNTANT'] },
    },
    select: { id: true, telegramChatId: true },
  });
  if (staff.length === 0) return 0;

  const { items } = await buildReportData(
    staff.map((person) => person.id),
    periodStart,
    periodEnd,
    now,
  );

  let sent = 0;
  for (const person of staff) {
    const item = items.find((row) => row.userId === person.id);
    if (!item) continue;
    if (item.planned === 0 && item.completed === 0 && item.unfinished.length === 0) continue;

    const lines = [
      'Итоги дня',
      '',
      `Запланировано: ${item.planned}`,
      `Выполнено: ${item.completed}`,
      ...(item.pending > 0 ? [`Ждёт приёмки: ${item.pending}`] : []),
      ...(item.overdue > 0 ? [`Просрочено: ${item.overdue}`] : []),
    ];
    if (item.unfinished.length > 0) {
      lines.push('', 'Незакрытые задачи:');
      for (const task of item.unfinished.slice(0, 10)) {
        lines.push(`• ${task.title}${task.overdue ? ' — просрочена' : ''}`);
      }
      if (item.unfinished.length > 10) lines.push(`…и ещё ${item.unfinished.length - 10}`);
    }

    await sendTelegramMessage(person.telegramChatId!, lines.join('\n'));
    sent += 1;
  }
  return sent;
}
