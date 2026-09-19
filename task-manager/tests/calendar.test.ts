import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEEKEND,
  isWorkingDay,
  nextWorkingDay,
  workingDaysBetween,
  type WorkingCalendar,
} from '@/lib/calendar';

const TZ = 'Asia/Tashkent';
const calendar = (holidays: string[] = [], weekend = DEFAULT_WEEKEND): WorkingCalendar => ({
  weekend,
  holidays: new Set(holidays),
  timezone: TZ,
});

// В сентябре 2026: 4-е — пятница, 5-е — суббота, 6-е — воскресенье, 7-е — понедельник
const at = (day: number, hour = 12) =>
  new Date(Date.UTC(2026, 8, day, hour - 5)); // -5 = перевод из Ташкента в UTC

describe('рабочий день', () => {
  it('будни рабочие, выходные — нет', () => {
    expect(isWorkingDay(at(4), calendar())).toBe(true);
    expect(isWorkingDay(at(5), calendar())).toBe(false);
    expect(isWorkingDay(at(6), calendar())).toBe(false);
    expect(isWorkingDay(at(7), calendar())).toBe(true);
  });

  it('праздник среди недели не рабочий', () => {
    expect(isWorkingDay(at(7), calendar(['2026-09-07']))).toBe(false);
  });

  it('состав выходных настраивается', () => {
    // если в компании выходной только воскресенье
    expect(isWorkingDay(at(5), calendar([], [7]))).toBe(true);
  });
});

describe('ближайший рабочий день', () => {
  it('суббота уезжает на понедельник', () => {
    expect(nextWorkingDay(at(5), calendar()).toISOString()).toBe(at(7).toISOString());
  });

  it('рабочий день остаётся на месте', () => {
    expect(nextWorkingDay(at(4), calendar()).toISOString()).toBe(at(4).toISOString());
  });

  it('перескакивает выходные вместе с праздником', () => {
    // пятница-праздник, дальше суббота и воскресенье
    expect(nextWorkingDay(at(4), calendar(['2026-09-04'])).toISOString()).toBe(at(7).toISOString());
  });
});

describe('перенос задачи считается в рабочих днях', () => {
  it('с пятницы на понедельник — один день, а не три', () => {
    expect(workingDaysBetween(at(4), at(7), calendar())).toBe(1);
  });

  it('в календарных днях это было бы три', () => {
    const calendarDays = Math.round((at(7).getTime() - at(4).getTime()) / 86_400_000);
    expect(calendarDays).toBe(3);
  });

  it('праздник тоже не считается', () => {
    expect(workingDaysBetween(at(4), at(8), calendar(['2026-09-07']))).toBe(1);
  });

  it('в пределах одного дня перенос нулевой', () => {
    expect(workingDaysBetween(at(4, 9), at(4, 18), calendar())).toBe(0);
  });
});
