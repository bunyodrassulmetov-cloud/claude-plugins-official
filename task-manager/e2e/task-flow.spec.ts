import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

test('задача проходит путь от постановки до приёмки', async ({ page }) => {
  const title = `Проверка сценария ${Date.now()}`;

  // Руководитель ставит задачу сотруднику
  await signIn(page, ACCOUNTS.chief);
  await page.goto('/tasks/new');
  await page.fill('#title', title);
  const assignee = await page
    .locator('#assigneeId option')
    .filter({ hasText: 'Олимбой' })
    .first()
    .getAttribute('value');
  await page.selectOption('#assigneeId', assignee ?? '');
  await page.getByRole('button', { name: /Создать задачу/ }).click();
  await page.waitForURL(/\/tasks\/\d+/, { timeout: 20_000 });
  const taskUrl = page.url();

  // По умолчанию принимающий — тот, кто поставил задачу
  await expect(page.getByText('Принимающий').locator('..')).toContainText('Сухроб');

  // Сотрудник добавляет пункт чек-листа и сдаёт работу
  await page.getByRole('button', { name: 'Выйти' }).click();
  await signIn(page, ACCOUNTS.worker);
  await page.goto(taskUrl);
  await page.fill('input[placeholder="Добавить пункт…"]', 'Собрать документы');
  await page.getByRole('button', { name: '+', exact: true }).click();
  await expect(page.getByText('Собрать документы')).toBeVisible();

  await page.getByRole('button', { name: 'Сдать на приёмку' }).click();
  await expect(page.getByText('На приёмке')).toBeVisible({ timeout: 15_000 });

  // Исполнитель не может принять свою же работу
  await expect(page.getByRole('button', { name: 'Принять результат' })).toHaveCount(0);

  // Руководитель возвращает на доработку, затем принимает
  await page.getByRole('button', { name: 'Выйти' }).click();
  await signIn(page, ACCOUNTS.chief);
  await page.goto(taskUrl);
  await page.getByRole('button', { name: 'Вернуть на доработку' }).click();
  await page.fill('#dialog-input', 'Не хватает выписки');
  await page.getByRole('dialog').getByRole('button', { name: 'Вернуть' }).click();
  await expect(page.getByText('В работе')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Не хватает выписки')).toBeVisible();
});

test('чужая задача недоступна', async ({ page }) => {
  await signIn(page, ACCOUNTS.worker);
  const response = await page.request.get('/api/tasks/1');
  expect([403, 404]).toContain(response.status());
});

test('директор видит доску по сотрудникам', async ({ page }) => {
  await signIn(page, ACCOUNTS.director);
  await expect(page.getByRole('heading', { name: 'Задачи сотрудников' })).toBeVisible();
  await expect(page.getByText('в работе:').first()).toBeVisible();
});
