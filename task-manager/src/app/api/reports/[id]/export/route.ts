import { NextRequest, NextResponse } from 'next/server';
import writeXlsxFile from 'write-excel-file/node';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { handle, parseId } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { formatDate, formatDateTime } from '@/lib/dates';
import type { UnfinishedTask } from '@/lib/jobs/reports';

type Cell = {
  value?: string | number;
  type?: typeof String | typeof Number;
  fontWeight?: 'bold';
  align?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  span?: number;
};

const HEAD: Omit<Cell, 'value'> = { fontWeight: 'bold', backgroundColor: '#e2e8f0' };
const RED = '#b91c1c';

const text = (value: string | null | undefined, extra: Omit<Cell, 'value'> = {}): Cell => ({
  value: value ?? '',
  type: String,
  ...extra,
});
const num = (value: number, extra: Omit<Cell, 'value'> = {}): Cell => ({
  value,
  type: Number,
  align: 'right',
  ...extra,
});

const PRIORITIES: Record<string, string> = {
  LOW: 'низкий',
  MEDIUM: 'средний',
  HIGH: 'высокий',
  CRITICAL: 'критичный',
};

/**
 * Выгрузка сводки в .xlsx: шапка, ширины колонок, просрочки красным.
 * Раньше был CSV — он открывался, но руководителю приходилось форматировать его руками.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;

    const report = await prisma.report.findFirst({
      where: { id: parseId(id), recipientId: user.id },
      include: {
        department: { select: { name: true } },
        items: {
          include: { user: { select: { fullName: true, position: true } } },
          orderBy: { overdue: 'desc' },
        },
      },
    });
    if (!report) throw new HttpError(404, 'Отчёт не найден');

    const { timezone } = await getSettings();
    const period = `${formatDate(report.periodStart, timezone)} — ${formatDate(report.periodEnd, timezone)}`;

    const rows: Cell[][] = [
      [text(`Отчёт: ${report.department?.name ?? 'вся компания'}`, { fontWeight: 'bold' })],
      [text(`Период: ${period}`)],
      [],
      [
        text('Сотрудник', HEAD),
        text('Должность', HEAD),
        text('Запланировано', HEAD),
        text('Выполнено', HEAD),
        text('На приёмке', HEAD),
        text('Просрочено', HEAD),
        text('Перенесено', HEAD),
      ],
    ];

    for (const item of report.items) {
      rows.push([
        text(item.user.fullName),
        text(item.user.position),
        num(item.planned),
        num(item.completed),
        num(item.pending),
        num(item.overdue, item.overdue > 0 ? { color: RED, fontWeight: 'bold' } : {}),
        num(item.carriedOver),
      ]);
    }

    const unfinishedRows: Cell[][] = [];
    for (const item of report.items) {
      for (const task of item.unfinished as unknown as UnfinishedTask[]) {
        unfinishedRows.push([
          text(item.user.fullName),
          text(task.title),
          text(formatDateTime(task.deadline, timezone), task.overdue ? { color: RED } : {}),
          text(PRIORITIES[task.priority] ?? task.priority),
          text(task.customer),
          text(task.acceptor),
          text(task.overdue ? 'да' : 'нет', task.overdue ? { color: RED, fontWeight: 'bold' } : {}),
        ]);
      }
    }

    if (unfinishedRows.length > 0) {
      rows.push([], [text('Невыполненные задачи', { fontWeight: 'bold' })]);
      rows.push([
        text('Сотрудник', HEAD),
        text('Задача', HEAD),
        text('Дедлайн', HEAD),
        text('Приоритет', HEAD),
        text('Заказчик', HEAD),
        text('Принимает', HEAD),
        text('Просрочена', HEAD),
      ]);
      rows.push(...unfinishedRows);
    }

    // Библиотека возвращает объект с методами вывода: берём буфер, файл на диск не нужен
    const buffer = await writeXlsxFile(rows as never, {
      sheet: 'Сводка',
      columns: [
        { width: 26 },
        { width: 34 },
        { width: 16 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
      ],
    }).toBuffer();

    const name = `otchet-${formatDate(report.periodStart, timezone).replace(/\./g, '-')}.xlsx`;
    return new NextResponse(new Uint8Array(buffer) as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
