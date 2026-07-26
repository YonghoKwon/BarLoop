import { expect, test, type Page } from '@playwright/test';

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('metronome keeps seven beats visible without horizontal clipping', async ({ page }) => {
  await page.goto('/#metronome');
  await page.getByLabel('박자 수').selectOption('7');

  const overview = page.getByLabel('현재 박자');
  await expect(overview.locator('i')).toHaveCount(7);
  await expect(overview).toContainText('4박 묶음');
  await expect(overview).toContainText('3박 묶음');

  const guide = page.getByLabel('한 마디 서브디비전 카운트');
  await expect(guide.locator('.count-beat-group')).toHaveCount(7);
  await expect(page.getByText('현재 1 / 7박')).toBeVisible();
  await expectNoPageOverflow(page);
});

test('drum sequencer expands to seven beats and marks syncopation cells', async ({ page }) => {
  await page.goto('/#drummer-training');
  await page.getByLabel('드럼 시퀀서 박자 수').selectOption('7');

  await expect(page.getByText('커스텀 28칸 시퀀서')).toBeVisible();
  const firstInstrument = page.locator('.drum-sequence-row').first();
  await expect(firstInstrument.locator('.drum-beat-group')).toHaveCount(7);
  await expect(page.getByLabel('7박 한 마디 16분음표 위치').locator(':scope > div')).toHaveCount(7);

  await page.getByRole('button', { name: '모든 &에 8분 엇박' }).click();
  await expect(page.getByLabel(/하이햇 & .*강세/)).toBeVisible();
  await expect(page.locator('.drum-substep-grid button.offbeat-cell').first()).toBeVisible();
  await expectNoPageOverflow(page);
});

test('odd-meter presets update the sequencer length and grouping', async ({ page }) => {
  await page.goto('/#drummer-training');
  await page.getByRole('button', { name: /5박 록 · 3\+2/ }).click();

  await expect(page.getByText('커스텀 20칸 시퀀서')).toBeVisible();
  await expect(page.getByText('추천 묶음 3+2')).toBeVisible();
  await expect(page.getByLabel('드럼 시퀀서 박자 수')).toHaveValue('5');
  await expectNoPageOverflow(page);
});
