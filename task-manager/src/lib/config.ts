/** Значения по умолчанию; часть из них переопределяется в таблице AppSetting. */
export const config = {
  jwtSecret: process.env.JWT_SECRET ?? '',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
  /** Cookie только по HTTPS. Выключается для развёртывания во внутренней сети по http://. */
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 20),
  timezone: process.env.APP_TIMEZONE ?? 'Europe/Moscow',
  dailyReportTime: process.env.DAILY_REPORT_TIME ?? '18:00',
  cronSecret: process.env.CRON_SECRET ?? '',
};

export const SETTING_KEYS = {
  dailyReportTime: 'daily_report_time',
  timezone: 'timezone',
  deadlineReminderHours: 'deadline_reminder_hours',
} as const;

export { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from './attachments';
