import type { Recurrence } from '@prisma/client';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  DAILY: 'Каждый день',
  WEEKLY: 'Каждую неделю',
  MONTHLY: 'Каждый месяц',
  QUARTERLY: 'Раз в квартал',
};

export type RecurrenceRule = {
  recurrence: Recurrence;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  dueHour: number;
  dueMinute: number;
};

function build(year: number, month: number, day: number, rule: RecurrenceRule, timezone: string) {
  const stamp =
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` +
    ` ${String(rule.dueHour).padStart(2, '0')}:${String(rule.dueMinute).padStart(2, '0')}:00`;
  return fromZonedTime(stamp, timezone);
}

/**
 * Ближайший срок строго позже `after`.
 * Все вычисления идут в рабочем часовом поясе: иначе «18:00 первого числа»
 * уезжало бы на соседние сутки при смене сервера.
 */
export function nextOccurrence(rule: RecurrenceRule, after: Date, timezone: string): Date {
  const local = toZonedTime(after, timezone);
  const year = local.getFullYear();
  const month = local.getMonth();
  const day = local.getDate();

  if (rule.recurrence === 'DAILY') {
    let candidate = build(year, month, day, rule, timezone);
    if (candidate <= after) {
      const tomorrow = toZonedTime(new Date(after.getTime() + 86_400_000), timezone);
      candidate = build(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), rule, timezone);
    }
    return candidate;
  }

  if (rule.recurrence === 'WEEKLY') {
    const target = rule.dayOfWeek ?? 1; // 1 — понедельник
    const current = local.getDay() === 0 ? 7 : local.getDay();
    let shift = (target - current + 7) % 7;
    let candidate = build(year, month, day + shift, rule, timezone);
    if (candidate <= after) {
      shift += 7;
      candidate = build(year, month, day + shift, rule, timezone);
    }
    return candidate;
  }

  // MONTHLY и QUARTERLY: шаг 1 или 3 месяца от заданного числа
  const step = rule.recurrence === 'QUARTERLY' ? 3 : 1;
  const targetDay = Math.min(rule.dayOfMonth ?? 1, 28);
  let y = year;
  let m = month;
  let candidate = build(y, m, targetDay, rule, timezone);
  for (let guard = 0; candidate <= after && guard < 24; guard += 1) {
    m += step;
    y += Math.floor(m / 12);
    m %= 12;
    candidate = build(y, m, targetDay, rule, timezone);
  }
  return candidate;
}

/** Человекочитаемое описание расписания для списка шаблонов. */
export function describeRule(rule: RecurrenceRule, timezone: string, next: Date) {
  const time = `${String(rule.dueHour).padStart(2, '0')}:${String(rule.dueMinute).padStart(2, '0')}`;
  const days = ['', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];
  const base =
    rule.recurrence === 'DAILY'
      ? `каждый день в ${time}`
      : rule.recurrence === 'WEEKLY'
        ? `каждую ${days[rule.dayOfWeek ?? 1]} в ${time}`
        : rule.recurrence === 'MONTHLY'
          ? `${rule.dayOfMonth ?? 1}-го числа каждого месяца в ${time}`
          : `${rule.dayOfMonth ?? 1}-го числа раз в квартал в ${time}`;
  return `${base} · следующая ${formatInTimeZone(next, timezone, 'dd.MM.yyyy HH:mm')}`;
}
