import { expect, test } from '@playwright/test';

test('accent flash defaults to a modern ring and can switch to impact', async ({ page }) => {
  await page.goto('/#metronome');
  await expect(page.getByRole('checkbox', { name: '강세 플래시' })).toBeChecked();

  const controls = page.getByLabel('강세 플래시 설정');
  await expect(controls.getByRole('tab', { name: '모던 링' })).toHaveAttribute('aria-selected', 'true');
  await expect(controls.getByRole('checkbox', { name: '화면 전체 빛' })).not.toBeChecked();
  await expect(controls.getByRole('checkbox', { name: 'ACCENT 배지' })).not.toBeChecked();

  await controls.getByRole('tab', { name: '임팩트' }).click();
  await expect(controls.getByRole('checkbox', { name: '화면 전체 빛' })).toBeChecked();
  await expect(controls.getByRole('checkbox', { name: 'ACCENT 배지' })).toBeChecked();
  await controls.getByRole('button', { name: '미리보기' }).click();

  const flash = page.getByTestId('accent-flash-effect');
  await expect(flash).toHaveClass(/accent-style-impact/);
  await expect(flash).toHaveClass(/accent-screen-on/);
  await expect(flash).toHaveClass(/accent-badge-on/);
});

test('drum training keeps the customizable flash enabled by default', async ({ page }) => {
  await page.goto('/#drummer-training');
  await expect(page.getByRole('checkbox', { name: '강세 화면 플래시' })).toBeChecked();
  await expect(page.getByLabel('강세 플래시 설정')).toBeVisible();
  await expect(page.locator('.training-orbit')).toBeVisible();
});
