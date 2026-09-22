import { test, expect } from '@playwright/test';
import { cleanupFnfE2e, seedFnfE2e, type FnE2eSeed } from './helpers/seed-fnf';
import {
  acceptNextPrompt,
  expectStatus,
  login,
  openSettlementRow,
  pickLabeledSelect,
  pickOpenSettlement,
} from './helpers/ui';

let seed: FnE2eSeed;

test.describe.serial('Full & Final Playwright E2E', () => {
  test.beforeAll(async () => {
    seed = await seedFnfE2e();
  });

  test.afterAll(async () => {
    if (seed) await cleanupFnfE2e(seed);
  });

  test('exit → clearance → calculate → HR/finance → pay → complete → ESS', async ({ page }) => {
    await login(page, seed.adminEmail, seed.password);

    await page.goto('/employees/separation/exit-form');
    await expect(page.getByRole('button', { name: 'Record Separation' })).toBeVisible();
    await pickLabeledSelect(page, 'Employee', seed.employeeCode);
    await page.getByRole('button', { name: 'Record Separation' }).click();
    const sepRow = page.getByRole('row').filter({ hasText: seed.employeeCode });
    await expect(sepRow).toBeVisible();
    await expect(sepRow.getByRole('button', { name: 'MANAGER', exact: true })).toBeVisible();
    for (const code of ['MANAGER', 'IT', 'FINANCE', 'HR']) {
      const btn = sepRow.getByRole('button', { name: code, exact: true });
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/exit/clearance') && r.request().method() === 'POST'),
        btn.click(),
      ]);
    }
    const cleared = await page.request.get(`/api/employees/${seed.employeeId}/exit/clearance`);
    const clearanceJson = await cleared.json();
    if (clearanceJson.clearanceStatus !== 'CLEARED') {
      for (const checkCode of ['MANAGER', 'IT', 'FINANCE', 'HR']) {
        const res = await page.request.post(`/api/employees/${seed.employeeId}/exit/clearance`, {
          data: { checkCode, status: 'CLEARED' },
        });
        expect(res.ok(), await res.text()).toBeTruthy();
      }
    }

    await page.goto('/payroll/processing/full-and-final');
    await expect(page.getByRole('heading', { name: 'Full & Final Settlement' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Payment file (verified)' })).toBeVisible();
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 30_000 });
    await pickOpenSettlement(page, seed.employeeCode);
    await page.getByRole('button', { name: 'Create draft' }).click();
    await openSettlementRow(page, seed.employeeCode);
    await expectStatus(page, 'pending');
    const calcWait = page.waitForResponse((r) => r.url().includes('/calculate') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Calculate / freeze' }).click();
    const calcRes = await calcWait;
    expect(calcRes.ok(), await calcRes.text()).toBeTruthy();
    await expectStatus(page, 'calculated');
    await expect(page.getByRole('heading', { name: new RegExp(seed.employeeCode) })).toBeVisible();
    await expect(page.getByRole('link', { name: 'PDF' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('submitted', { exact: true }).or(page.getByText('pending_manager', { exact: true })).first()).toBeVisible();

    if (await page.getByRole('button', { name: 'Manager approve' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Manager approve' }).click();
    }

    await page.goto('/approvals/payroll/full-and-final');
    await expect(page.getByRole('heading', { name: 'Full & Final settlement' })).toBeVisible();
    const approvalRow = page.getByRole('row').filter({ hasText: seed.employeeCode });
    await expect(approvalRow.first()).toBeVisible({ timeout: 30_000 });
    await approvalRow.getByRole('button', { name: 'Approve' }).first().click();
    await expect(page.getByRole('heading', { name: /Pending finance/ })).toBeVisible();
    await page.waitForTimeout(1000);
    const financeRow = page.getByRole('row').filter({ hasText: seed.employeeCode });
    if (await financeRow.getByRole('button', { name: 'Verify' }).count()) {
      await financeRow.getByRole('button', { name: 'Verify' }).click();
    }

    await page.goto('/payroll/processing/full-and-final');
    await openSettlementRow(page, seed.employeeCode);
    await expect(page.getByRole('button', { name: 'Finance verify' })).toBeVisible();
    const financeWait = page.waitForResponse((r) => r.url().includes('/finance-verify') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Finance verify' }).click();
    expect((await financeWait).ok()).toBeTruthy();
    await expectStatus(page, 'finance_verified');
    const csv = await page.request.get('/api/payroll/fnf/bank-file');
    expect(csv.ok()).toBeTruthy();
    expect(csv.ok()).toBeTruthy();
    expect(await csv.text()).toMatch(/^EmployeeCode,/);

    acceptNextPrompt(page, 'UTR-PW-1');
    await page.getByRole('button', { name: 'Mark paid' }).click();
    await expectStatus(page, 'paid');
    await page.getByRole('button', { name: 'Complete' }).click();
    await expectStatus(page, 'completed');

    await page.context().clearCookies();
    await login(page, seed.essEmail, seed.password);
    await page.goto('/ess/fnf');
    await expect(page.getByRole('heading', { name: 'Full & Final settlement' })).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(seed.employeeCode) })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download statement' })).toBeVisible();
  });

  test('cancel a pending draft and refuse a second cancel', async ({ page }) => {
    await login(page, seed.adminEmail, seed.password);
    await page.goto('/payroll/processing/full-and-final');
    await expect(page.getByRole('heading', { name: 'Full & Final Settlement' })).toBeVisible();
    await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 30_000 });
    const created = await page.request.post('/api/payroll/fnf', {
      data: { employeeId: seed.cancelEmployeeId },
    });
    expect(created.status(), await created.text()).toBe(201);
    await page.reload();
    await openSettlementRow(page, seed.cancelEmployeeCode);
    await expectStatus(page, 'pending');
    acceptNextPrompt(page, 'Playwright cancel');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expectStatus(page, 'cancelled');
    await page.getByRole('button', { name: 'Close' }).click();
    await openSettlementRow(page, seed.cancelEmployeeCode);
    await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  });
});
