import { expect, test, type Locator, type Page } from '@playwright/test';

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

function subdivisionSelect(scope: Page | ReturnType<Page['locator']>) {
  return scope.locator('label').filter({ hasText: '서브디비전' }).locator('select').first();
}

function countInSelect(scope: ReturnType<Page['locator']>) {
  return scope.locator('select:has(option[value="0"])');
}

function countInClickSelect(scope: ReturnType<Page['locator']>) {
  return scope.locator('select:has(option[value="subdivision"])');
}

async function loadLocalAudio(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '내 영상·음원' }).click();
  await page.locator('.drop-zone input[type="file"][accept*="audio"]').setInputFiles({
    name: 'practice.wav',
    mimeType: 'audio/wav',
    buffer: createWavBuffer(),
  });
  await expect(page.getByText('미디어를 불러왔습니다.', { exact: false })).toBeVisible();
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectFullBarWithoutInternalScroll(guide: Locator) {
  const metrics = await guide.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    cellCount: element.querySelectorAll(':scope > div > span').length,
  }));
  expect(metrics.cellCount).toBe(16);
  expect(metrics.scrollWidth - metrics.clientWidth).toBeLessThanOrEqual(1);
}

test('standalone metronome exposes the full subdivision guide', async ({ page }) => {
  await page.goto('/#metronome');
  await expect(page.getByRole('heading', { name: '드러머 메트로놈' })).toBeVisible();
  await subdivisionSelect(page).selectOption('4');
  const guide = page.getByLabel('한 마디 서브디비전 카운트');
  await expect(guide).toContainText('1');
  await expect(guide).toContainText('e');
  await expect(guide).toContainText('&');
  await expect(guide).toContainText('a');
  await expect(guide.locator('.count-beat-group')).toHaveCount(4);
  await expectFullBarWithoutInternalScroll(guide);
  await expectNoPageOverflow(page);
});

test('practice presets apply useful metronome settings', async ({ page }) => {
  await page.goto('/#metronome');
  await page.getByLabel('연습 프리셋 선택').selectOption({ label: '내부 박자 점검' });
  await page.getByRole('button', { name: '이 설정으로 연습 준비' }).click();

  await expect(page.getByLabel('메트로놈 BPM')).toHaveValue('100');
  const gapPanel = page.locator('section.lab-panel').filter({ has: page.getByRole('heading', { name: 'Gap Click' }) });
  await expect(gapPanel.locator('input[type="checkbox"]')).toBeChecked();
  await expect(page.getByText('내부 박자 점검 프리셋을 적용했습니다.', { exact: false })).toBeVisible();
});

test('media practice keeps the guide moving with click output disabled', async ({ page }) => {
  await loadLocalAudio(page);
  const panel = page.locator('section.metronome-panel');
  await subdivisionSelect(panel).selectOption('4');
  await countInSelect(panel).selectOption('0');
  const guide = panel.getByLabel('한 마디 서브디비전 카운트');
  await expect(guide).toBeVisible();
  await expect(guide.locator('.shared-count-beat')).toHaveCount(4);
  await expectFullBarWithoutInternalScroll(guide);
  await expectNoPageOverflow(page);

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
  const panel = page.locator('section.metronome-panel');
  await subdivisionSelect(panel).selectOption('4');
  await countInSelect(panel).selectOption('1');
  await countInClickSelect(panel).selectOption('subdivision');

  await page.locator('.play-button').click();
  await expect(panel.getByText('카운트인', { exact: false }).first()).toBeVisible();
  await expect(panel.getByLabel('한 마디 서브디비전 카운트')).toBeVisible();

  await page.getByRole('button', { name: '연습 화면' }).click();
  const dialog = page.getByRole('dialog', { name: '드러머 연습 모드' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('DRUM PRACTICE')).toBeVisible();
  const practiceGuide = dialog.getByLabel('한 마디 서브디비전 카운트');
  await expect(practiceGuide).toBeVisible();
  await expect(practiceGuide.locator('.shared-count-beat')).toHaveCount(4);
  await expectNoPageOverflow(page);
});


test('drummer training suite supports groove, sequencer and routines', async ({ page }) => {
  await page.goto('/#metronome');
  const suite = page.getByLabel('그루브 패턴 메트로놈').locator('..');
  await expect(page.getByRole('heading', { name: '리듬·루틴 트레이닝' })).toBeVisible();
  await expect(page.getByLabel('커스텀 리듬 시퀀서')).toBeVisible();
  await expect(page.getByLabel('악센트 이동 트레이너')).toBeVisible();
  await expect(page.getByLabel('연습 루틴 빌더')).toBeVisible();
  await page.getByRole('button', { name: /16비트 펑크/ }).click();
  await expect(page.getByText('16비트 펑크 그루브를 적용했습니다.')).toBeVisible();
  await page.getByLabel('킥 1 강세').click();
  await expect(page.getByLabel('킥 1 무음')).toBeVisible();
  await expectNoPageOverflow(page);
  await expect(suite).toBeVisible();
});


test('separates the metronome and drummer training pages', async ({ page }) => {
  await page.goto('/#metronome');
  await expect(page.getByRole('heading', { name: '드러머 메트로놈' })).toBeVisible();
  await expect(page.getByText('커스텀 16칸 시퀀서')).toHaveCount(0);
  await page.getByRole('button', { name: '드럼 트레이닝' }).click();
  await expect(page).toHaveURL(/#drummer-training/);
  await expect(page.getByRole('heading', { name: '드럼 트레이닝' })).toBeVisible();
  await expect(page.getByText('커스텀 16칸 시퀀서')).toBeVisible();
  await expect(page.getByText('랙 탐')).toBeVisible();
  await expect(page.getByText('플로어 탐')).toBeVisible();
  await expect(page.getByText('라이드')).toBeVisible();
  await expect(page.getByText('크래시')).toBeVisible();
});

test('allows clearing and replacing the first downbeat input', async ({ page }) => {
  await page.goto('/');
  const downbeat = page.locator('#downbeat');
  await expect(downbeat).toHaveValue('0.00');
  await downbeat.fill('');
  await expect(downbeat).toHaveValue('');
  await downbeat.fill('5.45');
  await downbeat.blur();
  await expect(downbeat).toHaveValue('5.45');
});
