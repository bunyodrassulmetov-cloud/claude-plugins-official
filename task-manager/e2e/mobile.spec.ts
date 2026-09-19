import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

const PAGES = ['/dashboard', '/tasks', '/tasks/new', '/templates', '/company', '/reports', '/profile'];

test('страницы помещаются в экран телефона', async ({ page }) => {
  await signIn(page, ACCOUNTS.chief);
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} шире экрана`).toBeLessThanOrEqual(2);
  }
});

test('кнопки достаточно крупные для пальца', async ({ page }) => {
  await signIn(page, ACCOUNTS.chief);
  await page.goto('/tasks', { waitUntil: 'networkidle' });
  const small = await page.evaluate(() => {
    const result: string[] = [];
    for (const el of document.querySelectorAll('button, a[href]')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.height < 36 || rect.width < 28) {
        result.push(`${el.tagName} ${(el.textContent ?? '').trim().slice(0, 20)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    return result;
  });
  expect(small, 'мелкие цели для касания').toEqual([]);
});

test('подтверждение открывается своим диалогом, а не окном браузера', async ({ page }) => {
  // window.confirm во встроенных браузерах подавляется — ловим попытку его вызвать
  let nativeDialog = false;
  page.on('dialog', async (dialog) => {
    nativeDialog = true;
    await dialog.dismiss();
  });

  await signIn(page, ACCOUNTS.chief);
  await page.goto('/tasks', { waitUntil: 'networkidle' });
  await page.locator('li a[href^="/tasks/"]').first().tap();
  await page.waitForURL(/\/tasks\/\d+/);

  const cancel = page.getByRole('button', { name: 'Отменить', exact: true });
  if (await cancel.count()) {
    await cancel.first().tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Не отменять' }).tap();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(nativeDialog, 'использовано окно браузера').toBe(false);
});

test('меню раскрывается касанием', async ({ page }) => {
  await signIn(page, ACCOUNTS.chief);
  await page.getByRole('button', { name: 'Меню' }).tap();
  await expect(page.getByRole('link', { name: 'Компания' }).last()).toBeVisible();
});
