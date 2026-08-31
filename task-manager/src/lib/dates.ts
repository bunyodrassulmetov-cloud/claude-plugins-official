import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { config } from './config';

/** Границы суток (00:00:00.000 — 23:59:59.999) в рабочем часовом поясе, в UTC. */
export function dayBounds(date: Date, timezone = config.timezone) {
  const day = formatInTimeZone(date, timezone, 'yyyy-MM-dd');
  return {
    start: fromZonedTime(`${day} 00:00:00`, timezone),
    end: fromZonedTime(`${day} 23:59:59.999`, timezone),
    day,
  };
}

export function startOfDayTz(date: Date, timezone = config.timezone) {
  return dayBounds(date, timezone).start;
}

export function endOfDayTz(date: Date, timezone = config.timezone) {
  return dayBounds(date, timezone).end;
}

/** Границы периода для отчётов: день / неделя (пн–вс) / месяц. */
export function periodBounds(
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  reference: Date,
  timezone = config.timezone,
) {
  const local = toZonedTime(reference, timezone);
  if (period === 'DAILY') {
    const { start, end } = dayBounds(reference, timezone);
    return { start, end };
  }
  if (period === 'WEEKLY') {
    const weekday = (local.getDay() + 6) % 7; // понедельник = 0
    const monday = new Date(local);
    monday.setDate(local.getDate() - weekday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: startOfDayTz(fromZonedTime(monday, timezone), timezone),
      end: endOfDayTz(fromZonedTime(sunday, timezone), timezone),
    };
  }
  const first = new Date(local.getFullYear(), local.getMonth(), 1);
  const last = new Date(local.getFullYear(), local.getMonth() + 1, 0);
  return {
    start: startOfDayTz(fromZonedTime(first, timezone), timezone),
    end: endOfDayTz(fromZonedTime(last, timezone), timezone),
  };
}

/** Значение для <input type="datetime-local"> в рабочем часовом поясе. */
export function toInputValue(date: Date | string, timezone = config.timezone) {
  return formatInTimeZone(new Date(date), timezone, "yyyy-MM-dd'T'HH:mm");
}

export function formatDateTime(date: Date | string, timezone = config.timezone) {
  return formatInTimeZone(new Date(date), timezone, 'dd.MM.yyyy HH:mm');
}

export function formatDate(date: Date | string, timezone = config.timezone) {
  return formatInTimeZone(new Date(date), timezone, 'dd.MM.yyyy');
}

/** "через 3 ч", "просрочено на 2 дн" — для карточек задач. */
export function humanizeDeadline(deadline: Date | string, now = new Date()) {
  const diffMs = new Date(deadline).getTime() - now.getTime();
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const value = minutes < 60 ? `${minutes} мин` : hours < 48 ? `${hours} ч` : `${days} дн`;
  return overdue ? `просрочено на ${value}` : `осталось ${value}`;
}
