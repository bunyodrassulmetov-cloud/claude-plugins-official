import { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/api';
import { HttpError } from '@/lib/auth';
import { config } from '@/lib/config';
import { markOverdueTasks } from '@/lib/jobs/overdue';
import { sendDeadlineReminders } from '@/lib/jobs/reminders';
import { generateDailyReports } from '@/lib/jobs/reports';

export const dynamic = 'force-dynamic';

/**
 * Точка входа для внешнего планировщика (системный crontab, Vercel Cron):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://host/api/cron/daily-report
 * Те же джобы запускает встроенный воркер (npm run worker).
 */
async function runJob(request: NextRequest, paramsPromise: Promise<{ job: string }>) {
  return handle(async () => {
    const header = request.headers.get('authorization') ?? '';
    const token = header.replace(/^Bearer\s+/i, '');
    if (!config.cronSecret || token !== config.cronSecret) {
      throw new HttpError(401, 'Неверный CRON_SECRET');
    }

    const { job } = await paramsPromise;
    switch (job) {
      case 'rollover':
        return ok(await markOverdueTasks());
      case 'reminders':
        return ok(await sendDeadlineReminders());
      case 'daily-report':
        return ok(await generateDailyReports());
      case 'weekly-report':
        return ok(await generateDailyReports(new Date(), 'WEEKLY'));
      case 'monthly-report':
        return ok(await generateDailyReports(new Date(), 'MONTHLY'));
      default:
        throw new HttpError(404, `Неизвестная задача: ${job}`);
    }
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  return runJob(request, params);
}

// Vercel Cron вызывает задания GET-запросом и сам подставляет заголовок с CRON_SECRET
export async function GET(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  return runJob(request, params);
}
