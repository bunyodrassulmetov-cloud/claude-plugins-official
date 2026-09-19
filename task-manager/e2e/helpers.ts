import type { Page } from '@playwright/test';

export const ACCOUNTS = {
  director: 'gayrat@company.ru',
  chief: 'suhrob@company.ru',
  worker: 'olimboy@company.ru',
  admin: 'admin@company.ru',
};

export const PASSWORD = process.env.E2E_PASSWORD ?? 'Password123!';

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/dashboard|admin/, { timeout: 20_000 });
}
