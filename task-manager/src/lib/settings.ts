import 'server-only';
import { prisma } from './db';
import { config, SETTING_KEYS } from './config';
import { DEFAULT_WEEKEND, type WorkingCalendar } from './calendar';

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.dailyReportTime]: config.dailyReportTime,
  [SETTING_KEYS.timezone]: config.timezone,
  [SETTING_KEYS.deadlineReminderHours]: '24',
  [SETTING_KEYS.weekend]: DEFAULT_WEEKEND.join(','),
};

export async function getSettings() {
  const rows = await prisma.appSetting.findMany();
  const map = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return {
    dailyReportTime: map[SETTING_KEYS.dailyReportTime],
    timezone: map[SETTING_KEYS.timezone],
    deadlineReminderHours: Number(map[SETTING_KEYS.deadlineReminderHours]) || 24,
    weekend: parseWeekend(map[SETTING_KEYS.weekend]),
  };
}

function parseWeekend(raw: string | undefined) {
  const days = (raw ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);
  return days.length > 0 ? days : DEFAULT_WEEKEND;
}

/** Рабочий календарь: выходные из настроек плюс праздники из базы. */
export async function getWorkingCalendar(): Promise<WorkingCalendar> {
  const [settings, holidays] = await Promise.all([
    getSettings(),
    prisma.nonWorkingDay.findMany({ select: { day: true } }),
  ]);
  return {
    weekend: settings.weekend,
    holidays: new Set(holidays.map((item) => item.day)),
    timezone: settings.timezone,
  };
}

export async function setSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
