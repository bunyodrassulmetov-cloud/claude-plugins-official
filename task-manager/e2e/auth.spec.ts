import { expect, test } from '@playwright/test';
import { ACCOUNTS, PASSWORD, signIn } from './helpers';

test('неверный пароль не пускает и не подсказывает, существует ли адрес', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', ACCOUNTS.chief);
  await page.fill('#password', 'заведомо-неверный');
  await page.click('button[type=submit]');
  await expect(page.locator('form [role=alert]')).toContainText('Неверный email или пароль');

  await page.fill('#email', 'нетакого@company.ru');
  await page.fill('#password', 'заведомо-неверный');
  await page.click('button[type=submit]');
  await expect(page.locator('form [role=alert]')).toContainText('Неверный email или пароль');
});

test('вход и выход', async ({ page }) => {
  await signIn(page, ACCOUNTS.chief);
  await expect(page.getByRole('link', { name: 'Задачи', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.waitForURL(/login/);
});

test('закрытые разделы не открываются без входа', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/reports');
  await page.waitForURL(/login/);
});

test('страница заявки на доступ открыта всем', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Отправить заявку' })).toBeVisible();
  expect(PASSWORD.length).toBeGreaterThan(0);
});
