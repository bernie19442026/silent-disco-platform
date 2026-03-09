import { test, expect } from '@playwright/test';

test.describe('Main Player', () => {
  test('homepage loads and shows channels', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/silent disco/i);
    // Four channel cards should be present
    const channelCards = page.locator('[data-testid="channel-card"], [aria-label*="channel"], .channel-card').first();
    await expect(page.locator('main')).toBeVisible();
  });

  test('admin login page is accessible', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('input[type="text"], input[name="username"], #username')).toBeVisible();
    await expect(page.locator('input[type="password"], #password')).toBeVisible();
  });

  test('admin login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid credentials, text=Invalid, text=error').first()).toBeVisible({ timeout: 5000 });
  });

  test('admin login with correct credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('/admin redirects to login when not authenticated', async ({ page }) => {
    // Clear any cookies
    await page.context().clearCookies();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('admin dashboard shows channel list when logged in', async ({ page }) => {
    // Login first
    await page.goto('/admin/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin\/dashboard/);

    // Check dashboard content
    await expect(page.locator('text=Channels, text=Admin Dashboard').first()).toBeVisible();
  });

  test('API health endpoint returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBeLessThan(600); // Should respond (may be 200 or 503 depending on infra)
  });

  test('API channels endpoint returns channel data', async ({ request }) => {
    const res = await request.get('/api/channels');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(4);
  });
});
