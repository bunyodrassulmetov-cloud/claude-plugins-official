import { NextRequest } from 'next/server';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { canManageUsers } from '@/lib/permissions';
import { getSettings, setSetting } from '@/lib/settings';
import { SETTING_KEYS } from '@/lib/config';
import { parseBody, settingsSchema } from '@/lib/validation';

export async function GET() {
  return handle(async () => {
    await requireUser();
    return ok(await getSettings());
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageUsers(user)) throw new HttpError(403, 'Настройки меняет администратор');
    const { data, error } = parseBody(settingsSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    await setSetting(SETTING_KEYS.dailyReportTime, data.dailyReportTime);
    await setSetting(SETTING_KEYS.timezone, data.timezone);
    await setSetting(SETTING_KEYS.deadlineReminderHours, String(data.deadlineReminderHours));
    return ok(await getSettings());
  });
}
