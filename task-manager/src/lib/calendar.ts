import { formatInTimeZone } from 'date-fns-tz';

/**
 * Рабочий календарь: выходные дни недели плюс список праздников.
 * Просрочка, посчитанная в календарных днях, наказывает за выходные —
 * задача со сроком в пятницу к понедельнику «просрочена на 3 дня».
 */
export type WorkingCalendar = {
  /** Номера выходных дней недели: 1 — понедельник, 7 — воскресенье */
  weekend: number[];
  /** Даты праздников в формате ГГГГ-ММ-ДД */
  holidays: Set<string>;
  timezone: string;
};

export const DEFAULT_WEEKEND = [6, 7];

export function dayKey(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

export function isoWeekday(date: Date, timezone: string) {
  const day = Number(formatInTimeZone(date, timezone, 'i'));
  return day;
}

export function isWorkingDay(date: Date, calendar: WorkingCalendar) {
  if (calendar.holidays.has(dayKey(date, calendar.timezone))) return false;
  return !calendar.weekend.includes(isoWeekday(date, calendar.timezone));
}

/** Ближайший рабочий день, начиная с указанного (сам день считается). */
export function nextWorkingDay(date: Date, calendar: WorkingCalendar, maxShiftDays = 30) {
  let cursor = date;
  for (let i = 0; i < maxShiftDays; i += 1) {
    if (isWorkingDay(cursor, calendar)) return cursor;
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return date; // подряд месяц выходных — что-то не так в настройках, не двигаем
}

/**
 * Сколько рабочих дней прошло между датами (начальный день не считается).
 * Именно это число показывается как «переносится N дней».
 */
export function workingDaysBetween(from: Date, to: Date, calendar: WorkingCalendar) {
  if (to <= from) return 0;
  let count = 0;
  let cursor = new Date(from.getTime() + 86_400_000);
  // Ограничение на случай очень старых задач: считать больше года смысла нет
  for (let i = 0; i < 400 && cursor <= to; i += 1) {
    if (isWorkingDay(cursor, calendar)) count += 1;
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return count;
}
