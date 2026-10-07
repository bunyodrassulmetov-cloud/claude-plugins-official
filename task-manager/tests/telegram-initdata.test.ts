import { describe, expect, it } from 'vitest';
import { signInitData, verifyInitData } from '@/lib/telegram-initdata';

const TOKEN = '8835325141:AAFtestTokenForUnitTestsOnly000000000';
const NOW = new Date('2026-10-07T12:00:00.000Z');
const authDate = String(Math.floor(NOW.getTime() / 1000) - 60);

const valid = () =>
  signInitData(
    {
      auth_date: authDate,
      query_id: 'AAE',
      user: JSON.stringify({ id: 424242, first_name: 'Зохид', username: 'zohid' }),
    },
    TOKEN,
  );

describe('данные мини-приложения', () => {
  it('принимает строку, подписанную токеном бота', () => {
    const result = verifyInitData(valid(), TOKEN, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe(424242);
      expect(result.user.firstName).toBe('Зохид');
    }
  });

  it('отвергает подпись, сделанную другим токеном', () => {
    const foreign = signInitData(
      { auth_date: authDate, user: JSON.stringify({ id: 1, first_name: 'Чужой' }) },
      'другой-токен',
    );
    expect(verifyInitData(foreign, TOKEN, NOW)).toMatchObject({ ok: false, reason: 'bad-signature' });
  });

  it('отвергает подменённые данные при сохранённой подписи', () => {
    // подменяем пользователя, оставляя чужой hash — классическая попытка войти за другого
    const tampered = valid().replace(/user=[^&]+/, `user=${encodeURIComponent(JSON.stringify({ id: 999, first_name: 'Админ' }))}`);
    expect(verifyInitData(tampered, TOKEN, NOW)).toMatchObject({ ok: false, reason: 'bad-signature' });
  });

  it('отвергает устаревшие данные', () => {
    const old = signInitData(
      {
        auth_date: String(Math.floor(NOW.getTime() / 1000) - 48 * 3600),
        user: JSON.stringify({ id: 1, first_name: 'Старый' }),
      },
      TOKEN,
    );
    expect(verifyInitData(old, TOKEN, NOW)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('отвергает дату из будущего', () => {
    const future = signInitData(
      {
        auth_date: String(Math.floor(NOW.getTime() / 1000) + 3600),
        user: JSON.stringify({ id: 1, first_name: 'Будущий' }),
      },
      TOKEN,
    );
    expect(verifyInitData(future, TOKEN, NOW)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('отвергает строку без подписи и пустую строку', () => {
    expect(verifyInitData('user=%7B%7D&auth_date=1', TOKEN, NOW)).toMatchObject({ reason: 'malformed' });
    expect(verifyInitData('', TOKEN, NOW)).toMatchObject({ reason: 'empty' });
  });

  it('отвергает подписанную строку без пользователя', () => {
    const noUser = signInitData({ auth_date: authDate, query_id: 'AAE' }, TOKEN);
    expect(verifyInitData(noUser, TOKEN, NOW)).toMatchObject({ ok: false, reason: 'no-user' });
  });

  it('без токена бота не принимает ничего', () => {
    expect(verifyInitData(valid(), '', NOW)).toMatchObject({ ok: false, reason: 'empty' });
  });
});
