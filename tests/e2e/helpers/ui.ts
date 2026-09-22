import { expect, type Page } from '@playwright/test';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

export async function pickLabeledSelect(page: Page, label: string, query: string) {
  const field = page.locator('div.flex.flex-col.gap-1').filter({ has: page.locator('label', { hasText: label }) }).first();
  await field.getByRole('button').click();
  const search = page.getByPlaceholder('Search...');
  await expect(search).toBeVisible();
  await search.fill(query);
  await page.getByRole('listbox').getByRole('button', { name: new RegExp(query) }).click();
}

export async function pickOpenSettlement(page: Page, query: string) {
  await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 30_000 });
  const trigger = page.getByRole('heading', { name: 'Open settlement' }).locator('xpath=..').getByRole('button', { name: '—' });
  await trigger.click();
  const search = page.getByPlaceholder('Search...');
  await expect(search).toBeVisible();
  await search.fill(query);
  await page.getByRole('listbox').getByRole('button', { name: new RegExp(query) }).click();
}

export async function acceptNextPrompt(page: Page, value: string) {
  page.once('dialog', async (dialog) => {
    await dialog.accept(value);
  });
}

export async function openSettlementRow(page: Page, employeeCode: string) {
  const row = page.getByRole('row').filter({ hasText: employeeCode }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole('button', { name: 'Open' }).click();
}

export async function expectStatus(page: Page, status: string) {
  await expect(page.getByText(status, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}
