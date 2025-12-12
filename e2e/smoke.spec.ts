import { test, expect } from '@playwright/test';

test('client flow and planner flow', async ({ page }) => {
  await page.goto('/');

  // Clients: create and delete
  await page.getByLabel('Add Client').click();
  await page.getByLabel('Client name').fill('E2E Client');
  await page.getByLabel('Loan amount').fill('750000');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText('E2E Client')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('Delete Client').click();
  await expect(page.getByText('E2E Client')).toHaveCount(0);

  // Planner: add event
  await page.getByRole('button', { name: 'Daily Planner' }).click();
  await page.getByLabel(/Add event at/i).first().click();
  await page.getByLabel('Event title').fill('E2E Event');
  await page.getByLabel(/Duration/).fill('30');
  const eventDialog = page.getByRole('dialog');
  await eventDialog.getByRole('button', { name: /^Add Event$/ }).click();

  await expect(page.getByText('E2E Event').first()).toBeVisible();
});
