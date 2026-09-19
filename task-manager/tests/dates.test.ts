import { describe, expect, it } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import { dayBounds, humanizeDeadline, periodBounds, toInputValue } from '@/lib/dates';

const TZ = 'Asia/Tashkent';

describe('dayBounds', () => {
  it('границы суток берутся в рабочем поясе, а не в UTC', () => {
    // 21:00 UTC = уже следующий день в Ташкенте (+5)
    const { start, end, day } = dayBounds(new Date('2026-09-04T21:00:00.000Z'), TZ);
    expect(day).toBe('2026-09-05');
    expect(start.toISOString()).toBe('2026-09-04T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-05T18:59:59.999Z');
  });

  it('любой момент суток даёт одни и те же границы', () => {
    const morning = dayBounds(new Date('2026-09-05T03:00:00.000Z'), TZ);
    const evening = dayBounds(new Date('2026-09-05T17:00:00.000Z'), TZ);
    expect(morning.start.toISOString()).toBe(evening.start.toISOString());
  });
});

describe('periodBounds', () => {
  it('неделя считается с понедельника по воскресенье', () => {
    // среда
    const { start, end } = periodBounds('WEEKLY', new Date('2026-09-09T10:00:00.000Z'), TZ);
    expect(formatInTimeZone(start, TZ, 'dd.MM EEE')).toBe('07.09 Mon');
    expect(formatInTimeZone(end, TZ, 'dd.MM EEE')).toBe('13.09 Sun');
  });

  it('месяц — с первого по последнее число', () => {
    const { start, end } = periodBounds('MONTHLY', new Date('2026-02-17T10:00:00.000Z'), TZ);
    expect(formatInTimeZone(start, TZ, 'dd.MM.yyyy')).toBe('01.02.2026');
    expect(formatInTimeZone(end, TZ, 'dd.MM.yyyy')).toBe('28.02.2026');
  });

  it('день совпадает с границами суток', () => {
    const reference = new Date('2026-09-05T10:00:00.000Z');
    expect(periodBounds('DAILY', reference, TZ).start.toISOString()).toBe(
      dayBounds(reference, TZ).start.toISOString(),
    );
  });
});

describe('toInputValue', () => {
  it('готовит значение для поля даты в рабочем поясе', () => {
    expect(toInputValue(new Date('2026-09-04T13:00:00.000Z'), TZ)).toBe('2026-09-04T18:00');
  });
});

describe('humanizeDeadline', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');

  it('показывает, сколько осталось', () => {
    expect(humanizeDeadline(new Date('2026-09-04T15:00:00.000Z'), now)).toBe('осталось 3 ч');
  });

  it('показывает просрочку', () => {
    expect(humanizeDeadline(new Date('2026-09-01T12:00:00.000Z'), now)).toBe('просрочено на 3 дн');
  });

  it('до часа считает в минутах', () => {
    expect(humanizeDeadline(new Date('2026-09-04T12:30:00.000Z'), now)).toBe('осталось 30 мин');
  });
});
