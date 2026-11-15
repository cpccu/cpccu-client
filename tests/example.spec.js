import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('CPCCU Portal');
  await expect(page.getByText('Total Visitors', { exact: true })).toBeVisible();
});

test('login page shows the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('#userMail')).toBeVisible();
  await expect(page.locator('#userPass')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
});
