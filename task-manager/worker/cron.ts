/**
 * Планировщик. Запускается отдельным процессом: npm run worker
 *
 * Джобы намеренно дёргаются по HTTP (/api/cron/*), а не импортом кода:
 * одна и та же реализация работает и здесь, и при внешнем планировщике
 * (системный crontab, Vercel Cron), поэтому поведение не расходится.
 */
import cron from 'node-cron';
import 'dotenv/config';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? '';
const TIMEZONE = process.env.APP_TIMEZONE ?? 'Europe/Moscow';
const DAILY_REPORT_TIME = process.env.DAILY_REPORT_TIME ?? '18:00';

if (!CRON_SECRET) {
  console.error('CRON_SECRET не задан — планировщик не сможет вызывать /api/cron/*');
  process.exit(1);
}

async function runJob(job: string) {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(`${APP_URL}/api/cron/${job}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[cron] ${startedAt} ${job} → HTTP ${response.status}`, payload);
      return;
    }
    console.log(`[cron] ${startedAt} ${job} →`, payload);
  } catch (error) {
    console.error(`[cron] ${startedAt} ${job} → сеть недоступна`, error);
  }
}

const [reportHour, reportMinute] = DAILY_REPORT_TIME.split(':');
const options = { timezone: TIMEZONE } as const;

// 00:05 — пометить просроченное и перенести хвосты в текущий день
cron.schedule('5 0 * * *', () => runJob('rollover'), options);
// каждый час — напоминания о приближающихся дедлайнах и актуализация просрочки
cron.schedule('0 * * * *', () => runJob('reminders'), options);
cron.schedule('30 * * * *', () => runJob('rollover'), options);
// конец рабочего дня — сводка руководителям (будни)
cron.schedule(`${Number(reportMinute)} ${Number(reportHour)} * * 1-5`, () => runJob('daily-report'), options);
// пятница вечером — недельная сводка; 1-е число — месячная
cron.schedule(`${Number(reportMinute)} ${Number(reportHour)} * * 5`, () => runJob('weekly-report'), options);
cron.schedule('30 6 1 * *', () => runJob('monthly-report'), options);

console.log(
  `[cron] планировщик запущен: ${APP_URL}, TZ=${TIMEZONE}, ежедневный отчёт в ${DAILY_REPORT_TIME}`,
);

// Ручной прогон при старте: npm run worker -- --now
if (process.argv.includes('--now')) {
  void (async () => {
    await runJob('rollover');
    await runJob('reminders');
    await runJob('daily-report');
  })();
}
