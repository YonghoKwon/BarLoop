import { expect, test, type Page } from '@playwright/test';

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('metronome offers modern accent flash customization and preview', async ({ page }) => {
  await page.goto('/#metronome');
  const controls = page.getByLabel('강세 플래시 설정');
  await expect(controls).toBeVisible();
  await controls.getByRole('tab', { name: '소프트 글로우' }).click();
  await controls.getByRole('button', { name: '민트' }).click();
  await controls.getByLabel('플래시 강도').evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await controls.getByLabel('플래시 길이').selectOption('long');
  await controls.getByRole('button', { name: '미리보기' }).click();

  const effect = page.getByTestId('accent-flash-effect');
  await expect(effect).toBeVisible();
  await expect(effect).toHaveClass(/accent-style-glow/);
  await expect(effect).toHaveClass(/accent-tone-mint/);
  await expectNoPageOverflow(page);
});

test('drummer training explains eighth offbeats separately from sixteenth positions', async ({ page }) => {
  await page.goto('/#drummer-training');
  await expect(page.getByLabel('강세 플래시 설정')).toBeVisible();
  const explainer = page.getByLabel('엇박 이해하기');
  await expect(explainer).toContainText('8분 엇박');
  await expect(explainer).toContainText('16분 사이');
  await page.getByRole('button', { name: '모든 &에 8분 엇박' }).click();
  await expect(page.getByLabel(/하이햇 1 & 8분 엇박 강세/)).toBeVisible();
  await expect(page.locator('.drum-substep-grid button.eighth-offbeat-cell').first()).toBeVisible();
  await expect(page.locator('.drum-substep-grid button.sixteenth-between-cell').first()).toBeVisible();
  await expectNoPageOverflow(page);
});
