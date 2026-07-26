import { expect, test, type Page } from '@playwright/test';

function createWavBuffer(durationSeconds = 12, sampleRate = 8000): Buffer {
  const samples = Math.round(durationSeconds * sampleRate); const dataLength = samples * 2; const buffer = Buffer.alloc(44 + dataLength);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataLength, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(dataLength, 40); return buffer;
}
async function loadAudio(page: Page) { await page.goto('/'); await page.getByRole('button', { name: '내 영상·음원' }).click(); await page.locator('.drop-zone input[type="file"]').setInputFiles({ name: 'loop.wav', mimeType: 'audio/wav', buffer: createWavBuffer() }); await expect(page.getByText('미디어를 불러왔습니다.', { exact: false })).toBeVisible(); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); }

test('bar loop uses A/B sliders and current bar status instead of select boxes', async ({ page }) => {
  await loadAudio(page); await page.locator('#bpm').fill('120'); await page.getByRole('button', { name: '마디 나누기' }).click();
  const picker = page.getByLabel('마디 반복 범위 편집기'); await expect(picker).toBeVisible();
  await expect(picker.getByLabel('A 시작 마디')).toBeVisible(); await expect(picker.getByLabel('B 종료 마디')).toBeVisible();
  await expect(picker.locator('select')).toHaveCount(0); await picker.getByRole('button', { name: '4마디' }).click();
  await expect(picker.getByText('길이 4마디')).toBeVisible(); await noOverflow(page);
});

test('practice mode clearly shows current bar and repeat range', async ({ page }) => {
  await loadAudio(page); await page.getByRole('button', { name: '마디 나누기' }).click(); await page.getByRole('button', { name: '연습 화면' }).click();
  const dialog = page.getByRole('dialog', { name: '드러머 연습 모드' }); await expect(dialog).toBeVisible();
  await expect(dialog.getByText('현재 마디')).toBeVisible(); await expect(dialog.getByText('반복 범위')).toBeVisible(); await expect(dialog.getByText('A부터 다시')).toBeVisible(); await noOverflow(page);
});

test('media metronome separates normal and accent click sounds', async ({ page }) => {
  await page.goto('/'); const panel = page.locator('section.metronome-panel');
  await expect(panel.getByLabel('기본 클릭 음색')).toBeVisible(); await expect(panel.getByLabel('강조 클릭 음색')).toBeVisible();
  await panel.getByLabel('기본 클릭 음색').selectOption('rim'); await panel.getByLabel('강조 클릭 음색').selectOption('cowbell'); await noOverflow(page);
});

test('drum training exposes click subdivision and 4/5 piece kit modes', async ({ page }) => {
  await page.goto('/#drummer-training'); const panel = page.getByLabel('드럼 트레이닝 클릭 가이드 설정');
  await expect(panel.getByLabel('클릭 서브디비전')).toBeVisible(); await panel.getByLabel('클릭 서브디비전').selectOption('3');
  await panel.getByLabel('드럼 구성').selectOption('5'); await expect(page.getByText('미들 탐', { exact: true })).toBeVisible();
  await panel.getByLabel('드럼 구성').selectOption('4'); await expect(page.getByText('미들 탐', { exact: true })).toHaveCount(0); await noOverflow(page);
});
