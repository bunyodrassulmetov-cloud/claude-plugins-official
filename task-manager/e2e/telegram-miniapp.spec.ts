import { createHmac } from 'node:crypto';
import { expect, test, type Browser } from '@playwright/test';
import { PASSWORD } from './helpers';

/**
 * Проверки мини-приложения Telegram. Telegram подменяется: в страницу
 * подставляется window.Telegram.WebApp с подписанной строкой — ровно то,
 * что видит приложение внутри настоящего клиента.
 */
const TOKEN = process.env.E2E_TELEGRAM_BOT_TOKEN;

test.skip(!TOKEN, 'нужен E2E_TELEGRAM_BOT_TOKEN — тот же токен, с которым запущено приложение');
test.describe.configure({ mode: 'serial' });

function initDataFor(id: number, firstName: string) {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAE',
    user: JSON.stringify({ id, first_name: firstName }),
  };
  const check = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN!).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function telegramPage(browser: Browser, initData: string) {
  const context = await browser.newContext();
  await context.addInitScript((data) => {
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: { initData: data, ready() {}, expand() {}, colorScheme: 'light' },
    };
  }, initData);
  return context.newPage();
}

test('привязанный Telegram пускает без пароля', async ({ browser, request }) => {
  // Привязываем Зохида к условному чату через обычный вход и attach
  const page = await telegramPage(browser, initDataFor(424242, 'Зохид'));
  await page.goto('/login');
  await page.fill('#email', 'zohid@company.ru');
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/dashboard/);
  const attach = await page.request.post('/api/telegram/attach', {
    data: { initData: initDataFor(424242, 'Зохид') },
  });
  expect(attach.ok()).toBe(true);

  // Новая сессия без cookie — вход только по данным Telegram
  const fresh = await telegramPage(browser, initDataFor(424242, 'Зохид'));
  await fresh.goto('/tma');
  await fresh.waitForURL(/dashboard/, { timeout: 20_000 });
  expect(request).toBeTruthy();
});

test('поддельная подпись не пускает', async ({ browser }) => {
  const forged = initDataFor(424242, 'Зохид').replace(/hash=[0-9a-f]+/, `hash=${'a'.repeat(64)}`);
  const page = await telegramPage(browser, forged);
  await page.goto('/tma');
  await expect(page.getByText('Не получилось открыть')).toBeVisible({ timeout: 20_000 });
});

test('открытое вне Telegram объясняет себя и предлагает браузер', async ({ page }) => {
  await page.goto('/tma');
  await expect(page.getByText('Не получилось открыть')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Войти через браузер' })).toBeVisible();
});
