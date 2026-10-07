import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Проверка данных, которыми Telegram представляет открывшего мини-приложение.
 *
 * Telegram подписывает строку `initData` ключом, производным от токена бота.
 * Если подпись сходится, данным можно верить: подделать их, не зная токена, нельзя.
 * Поэтому проверка — единственное, что отделяет вход без пароля от входа кем угодно.
 */
export type TelegramUser = {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
};

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: Date }
  | { ok: false; reason: 'empty' | 'malformed' | 'bad-signature' | 'expired' | 'no-user' };

/** Сколько живёт открытая сессия мини-приложения, прежде чем потребуется переоткрыть. */
const MAX_AGE_SECONDS = 24 * 3600;

export function verifyInitData(
  initData: string,
  botToken: string,
  now = new Date(),
  maxAgeSeconds = MAX_AGE_SECONDS,
): InitDataResult {
  if (!initData || !botToken) return { ok: false, reason: 'empty' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'malformed' };

  // Строка проверки: все поля, кроме hash, по алфавиту, через перевод строки
  params.delete('hash');
  const checkString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest('hex');

  const given = Buffer.from(hash, 'hex');
  const mine = Buffer.from(expected, 'hex');
  if (given.length !== mine.length || !timingSafeEqual(given, mine)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) return { ok: false, reason: 'malformed' };
  const age = now.getTime() / 1000 - authDate;
  // Просроченные данные не принимаем: иначе перехваченная строка работала бы вечно
  if (age > maxAgeSeconds || age < -300) return { ok: false, reason: 'expired' };

  let parsed: { id?: number; first_name?: string; last_name?: string; username?: string };
  try {
    parsed = JSON.parse(params.get('user') ?? 'null');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!parsed?.id) return { ok: false, reason: 'no-user' };

  return {
    ok: true,
    authDate: new Date(authDate * 1000),
    user: {
      id: parsed.id,
      firstName: parsed.first_name ?? '',
      lastName: parsed.last_name,
      username: parsed.username,
    },
  };
}

/** Собирает подписанную строку — нужна тестам и отладке. */
export function signInitData(fields: Record<string, string>, botToken: string) {
  const checkString = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
