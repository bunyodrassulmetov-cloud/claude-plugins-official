import { describe, expect, it } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import { describeRule, nextOccurrence, type RecurrenceRule } from '@/lib/recurrence';

const TZ = 'Asia/Tashkent';
const at = (iso: string) => new Date(iso);
const show = (date: Date) => formatInTimeZone(date, TZ, 'dd.MM.yyyy HH:mm');

const rule = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  recurrence: 'MONTHLY',
  dayOfWeek: null,
  dayOfMonth: null,
  dueHour: 18,
  dueMinute: 0,
  ...over,
});

describe('nextOccurrence', () => {
  // Пятница, 14:00 по Ташкенту
  const friday = at('2026-09-04T09:00:00.000Z');

  it('ежедневно: сегодняшний срок, если он ещё не наступил', () => {
    expect(show(nextOccurrence(rule({ recurrence: 'DAILY' }), friday, TZ))).toBe('04.09.2026 18:00');
  });

  it('ежедневно: завтра, если время уже прошло', () => {
    const past = rule({ recurrence: 'DAILY', dueHour: 10 });
    expect(show(nextOccurrence(past, friday, TZ))).toBe('05.09.2026 10:00');
  });

  it('еженедельно: ближайший нужный день недели', () => {
    const monday = rule({ recurrence: 'WEEKLY', dayOfWeek: 1, dueHour: 9 });
    expect(show(nextOccurrence(monday, friday, TZ))).toBe('07.09.2026 09:00');
  });

  it('еженедельно: сегодня, если день совпал и время не прошло', () => {
    const today = rule({ recurrence: 'WEEKLY', dayOfWeek: 5 });
    expect(show(nextOccurrence(today, friday, TZ))).toBe('04.09.2026 18:00');
  });

  it('ежемесячно: число этого месяца, затем следующего', () => {
    const tenth = rule({ dayOfMonth: 10 });
    const first = nextOccurrence(tenth, friday, TZ);
    expect(show(first)).toBe('10.09.2026 18:00');
    expect(show(nextOccurrence(tenth, first, TZ))).toBe('10.10.2026 18:00');
  });

  it('ежемесячно: переходит на следующий месяц, если число прошло', () => {
    expect(show(nextOccurrence(rule({ dayOfMonth: 1 }), friday, TZ))).toBe('01.10.2026 18:00');
  });

  it('квартально: шаг ровно три месяца', () => {
    const q = rule({ recurrence: 'QUARTERLY', dayOfMonth: 25 });
    const first = nextOccurrence(q, friday, TZ);
    expect(show(first)).toBe('25.09.2026 18:00');
    expect(show(nextOccurrence(q, first, TZ))).toBe('25.12.2026 18:00');
  });

  it('число больше 28 обрезается: февраль не теряет срок', () => {
    const late = rule({ dayOfMonth: 31 });
    const january = at('2026-01-05T00:00:00.000Z');
    expect(show(nextOccurrence(late, january, TZ))).toBe('28.01.2026 18:00');
  });

  it('всегда возвращает момент строго в будущем', () => {
    const cases: RecurrenceRule[] = [
      rule({ recurrence: 'DAILY' }),
      rule({ recurrence: 'WEEKLY', dayOfWeek: 3 }),
      rule({ dayOfMonth: 15 }),
      rule({ recurrence: 'QUARTERLY', dayOfMonth: 1 }),
    ];
    for (const item of cases) {
      let cursor = friday;
      for (let i = 0; i < 6; i += 1) {
        const next = nextOccurrence(item, cursor, TZ);
        expect(next.getTime()).toBeGreaterThan(cursor.getTime());
        cursor = next;
      }
    }
  });

  it('еженедельно на стыке месяцев: дата не выходит за календарь', () => {
    // 30 сентября + 7 дней наивно давало «37 сентября» — несуществующую дату
    const monday = rule({ recurrence: 'WEEKLY', dayOfWeek: 1, dueHour: 9 });
    const endOfMonth = at('2026-09-29T10:00:00.000Z');
    const next = nextOccurrence(monday, endOfMonth, TZ);
    expect(Number.isNaN(next.getTime())).toBe(false);
    expect(show(next)).toBe('05.10.2026 09:00');
  });

  it('срок считается в рабочем часовом поясе, а не в UTC', () => {
    const evening = rule({ recurrence: 'DAILY', dueHour: 18 });
    const result = nextOccurrence(evening, friday, TZ);
    // 18:00 в Ташкенте = 13:00 UTC
    expect(result.toISOString()).toBe('2026-09-04T13:00:00.000Z');
  });
});

describe('describeRule', () => {
  it('описывает расписание по-русски', () => {
    const text = describeRule(rule({ dayOfMonth: 5 }), TZ, at('2026-10-05T13:00:00.000Z'));
    expect(text).toContain('5-го числа каждого месяца в 18:00');
    expect(text).toContain('05.10.2026');
  });
});
