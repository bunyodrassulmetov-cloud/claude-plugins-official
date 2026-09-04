import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { handle, parseId } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { formatDate, formatDateTime } from '@/lib/dates';
import type { UnfinishedTask } from '@/lib/jobs/reports';

/** Экранирование для CSV: кавычки удваиваются, поле берётся в кавычки. */
function cell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Выгрузка сводки в CSV с разделителем «;» и BOM —
 * такой файл Excel открывает по двойному клику, без мастера импорта.
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
    const lines: string[] = [];

    lines.push(
      [
        cell('Отчёт'),
        cell(report.department?.name ?? 'Вся компания'),
        cell(`${formatDate(report.periodStart, timezone)} — ${formatDate(report.periodEnd, timezone)}`),
      ].join(';'),
    );
    lines.push('');
    lines.push(
      ['Сотрудник', 'Должность', 'Запланировано', 'Выполнено', 'На приёмке', 'Просрочено', 'Перенесено']
        .map(cell)
        .join(';'),
    );
    for (const item of report.items) {
      lines.push(
        [
          cell(item.user.fullName),
          cell(item.user.position),
          item.planned,
          item.completed,
          item.pending,
          item.overdue,
          item.carriedOver,
        ].join(';'),
      );
    }

    lines.push('');
    lines.push(['Невыполненные задачи'].map(cell).join(';'));
    lines.push(
      ['Сотрудник', 'Задача', 'Дедлайн', 'Приоритет', 'Заказчик', 'Принимает', 'Просрочена']
        .map(cell)
        .join(';'),
    );
    const priorities: Record<string, string> = {
      LOW: 'низкий',
      MEDIUM: 'средний',
      HIGH: 'высокий',
      CRITICAL: 'критичный',
    };
    for (const item of report.items) {
      for (const task of item.unfinished as unknown as UnfinishedTask[]) {
        lines.push(
          [
            cell(item.user.fullName),
            cell(task.title),
            cell(formatDateTime(task.deadline, timezone)),
            cell(priorities[task.priority] ?? task.priority),
            cell(task.customer),
            cell(task.acceptor),
            cell(task.overdue ? 'да' : 'нет'),
          ].join(';'),
        );
      }
    }

    const csv = `﻿${lines.join('\r\n')}`;
    const name = `otchet-${formatDate(report.periodStart, timezone).replace(/\./g, '-')}.csv`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
