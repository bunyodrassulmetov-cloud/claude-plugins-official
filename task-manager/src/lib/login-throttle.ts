import 'server-only';
import { prisma } from './db';

/**
 * Защита входа от перебора паролей.
 * Считаем неудачи по паре «email + IP»: блокировка только по email позволила бы
 * посторонним запирать чужие учётные записи, а только по IP — не мешала бы
 * перебирать пароли из разных сетей.
 */
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

export function clientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

function key(email: string, ip: string) {
  return `${email.toLowerCase()}|${ip}`.slice(0, 190);
}

/** Сколько секунд ждать, если вход временно заблокирован; иначе null. */
export async function lockedForSeconds(email: string, ip: string) {
  const record = await prisma.loginAttempt.findUnique({ where: { key: key(email, ip) } });
  if (!record?.lockedUntil) return null;
  const remaining = record.lockedUntil.getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : null;
}

export async function registerFailure(email: string, ip: string) {
  const id = key(email, ip);
  const now = new Date();
  const record = await prisma.loginAttempt.findUnique({ where: { key: id } });

  // Окно истекло — начинаем счёт заново
  if (!record || now.getTime() - record.firstFailAt.getTime() > WINDOW_MS) {
    await prisma.loginAttempt.upsert({
      where: { key: id },
      update: { failures: 1, firstFailAt: now, lockedUntil: null },
      create: { key: id, failures: 1, firstFailAt: now },
    });
    return;
  }

  const failures = record.failures + 1;
  await prisma.loginAttempt.update({
    where: { key: id },
    data: {
      failures,
      lockedUntil: failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null,
    },
  });
}

export async function clearFailures(email: string, ip: string) {
  await prisma.loginAttempt.deleteMany({ where: { key: key(email, ip) } });
}
