import { expect, test } from '@playwright/test';

function createWavBuffer(durationSeconds = 4, sampleRate = 8000): Buffer {
  const samples = Math.round(durationSeconds * sampleRate);
  const dataLength = samples * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  return buffer;
}

async function loadLocalAudio(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/');
  await page.getByRole('button', { name: '내 영상·음원' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'practice.wav',
    mimeType: 'audio/wav',
    buffer: createWavBuffer(),
  });
  await expect(page.getByText('미디어를 불러왔습니다.', { exact: false })).toBeVisible();
}

test('standalone metronome exposes the full subdivision guide', async ({ page }) => {
  await page.goto('/#metronome');
  await expect(page.getByRole('heading', { name: '드러머 메트로놈' })).toBeVisible();
  await page.getByLabel('서브디비전').selectOption('4');
  const guide = page.getByLabel('한 마디 서브디비전 카운트');
  await expect(guide).toContainText('1');
  await expect(guide).toContainText('e');
  await expect(guide).toContainText('&');
  await expect(guide).toContainText('a');
});

test('media practice keeps the guide moving with click output disabled', async ({ page }) => {
  await loadLocalAudio(page);
  const panel = page.getByRole('heading', { name: '메트로놈·카운트인' }).locator('..').locator('..');
  await panel.getByLabel('서브디비전').selectOption('4');
  await panel.getByLabel('카운트인').selectOption('0');
  await expect(panel.getByLabel('한 마디 서브디비전 카운트')).toBeVisible();

  await page.locator('.play-button').click();
  const activeLabel = panel.locator('.shared-count-beat span.active strong');
  await expect(activeLabel).toBeVisible();
  const first = await activeLabel.textContent();
  await page.waitForTimeout(650);
  const later = await activeLabel.textContent();
  expect(later).not.toBe(first);
});

test('count-in and full practice overlay show the shared count grid', async ({ page }) => {
  await loadLocalAudio(page);
  const panel = page.getByRole('heading', { name: '메트로놈·카운트인' }).locator('..').locator('..');
  await panel.getByLabel('서브디비전').selectOption('4');
  await panel.getByLabel('카운트인').selectOption('1');
  await panel.getByLabel('카운트인 클릭').selectOption('subdivision');

  await page.locator('.play-button').click();
  await expect(panel.getByText('카운트인', { exact: false })).toBeVisible();
  await expect(panel.getByLabel('한 마디 서브디비전 카운트')).toBeVisible();

  await page.getByRole('button', { name: '연습 화면' }).click();
  await expect(page.getByRole('dialog', { name: '드러머 연습 모드' })).toBeVisible();
  await expect(page.getByText('DRUM PRACTICE')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('한 마디 서브디비전 카운트')).toBeVisible();
});
