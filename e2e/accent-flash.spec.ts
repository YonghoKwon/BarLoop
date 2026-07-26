import { expect, test } from '@playwright/test';

test('accent flash provides a full-screen burst and clear label', async ({ page }) => {
  await page.goto('/#metronome');
  await expect(page.getByRole('checkbox', { name: '강세 플래시' })).toBeChecked();

  const flash = page.locator('.accent-flash-wave');
  await page.evaluate(() => {
    const orbit = document.querySelector('.beat-orbit');
    if (!orbit) throw new Error('Beat orbit was not rendered.');
    const element = document.createElement('i');
    element.className = 'accent-flash-wave metronome-flash';
    element.setAttribute('aria-hidden', 'true');
    orbit.appendChild(element);
  });

  await expect(flash).toHaveCount(1);
  const styles = await flash.evaluate((element) => ({
    ringAnimation: getComputedStyle(element).animationName,
    ringBorder: getComputedStyle(element).borderTopWidth,
    screenPosition: getComputedStyle(element, '::before').position,
    screenAnimation: getComputedStyle(element, '::before').animationName,
    badgeContent: getComputedStyle(element, '::after').content,
    badgeAnimation: getComputedStyle(element, '::after').animationName,
  }));

  expect(styles.ringAnimation).toContain('accent-ring');
  expect(Number.parseFloat(styles.ringBorder)).toBeGreaterThanOrEqual(4);
  expect(styles.screenPosition).toBe('fixed');
  expect(styles.screenAnimation).toContain('accent-screen');
  expect(styles.badgeContent).toContain('강세');
  expect(styles.badgeAnimation).toContain('accent-badge');
});

test('drum training keeps the enhanced flash control enabled by default', async ({ page }) => {
  await page.goto('/#drummer-training');
  await expect(page.getByRole('checkbox', { name: '강세 화면 플래시' })).toBeChecked();
  await expect(page.locator('.training-orbit')).toBeVisible();
});
