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

test('восстановление пароля: форма доступна и честно отвечает без настроенной почты', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByRole('link', { name: 'Забыли пароль?' }).click();
  await page.waitForURL(/forgot/);
  await page.fill('#f-email', 'olimboy@company.ru');
  await page.getByRole('button', { name: 'Прислать ссылку' }).click();
  // Либо письмо ушло, либо приложение сообщает, что почта не настроена — оба ответа корректны
  await expect(
    page.locator('text=/Письмо отправлено|Отправка писем не настроена/'),
  ).toBeVisible({ timeout: 10_000 });
});

test('ссылка смены пароля без токена не работает', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/reset');
  await expect(page.getByText('Ссылка неполная')).toBeVisible();
});

test('страница заявки на доступ открыта всем', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/register');
  await expect(page.getByRole('button', { name: 'Отправить заявку' })).toBeVisible();
  expect(PASSWORD.length).toBeGreaterThan(0);
});
