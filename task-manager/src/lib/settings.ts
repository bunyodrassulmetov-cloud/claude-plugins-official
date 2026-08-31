import 'server-only';
import { prisma } from './db';
import { config, SETTING_KEYS } from './config';

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.dailyReportTime]: config.dailyReportTime,
  [SETTING_KEYS.timezone]: config.timezone,
  [SETTING_KEYS.deadlineReminderHours]: '24',
};

export async function getSettings() {
  const rows = await prisma.appSetting.findMany();
  const map = { ...DEFAULTS };
  for (const row of rows) map[row.key] = row.value;
  return {
    dailyReportTime: map[SETTING_KEYS.dailyReportTime],
    timezone: map[SETTING_KEYS.timezone],
    deadlineReminderHours: Number(map[SETTING_KEYS.deadlineReminderHours]) || 24,
  };
}

export async function setSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
