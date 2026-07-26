from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'Expected text not found in {path}: {old[:120]!r}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/components/AccentFlashControls.tsx',
    "interface AccentFlashControlsProps {\n  enabled: boolean;",
    "interface AccentFlashControlsProps {\n  enabled: boolean;\n  toggleLabel: string;",
)
replace_once(
    'src/components/AccentFlashControls.tsx',
    "export default function AccentFlashControls({\n  enabled,\n  settings,",
    "export default function AccentFlashControls({\n  enabled,\n  toggleLabel,\n  settings,",
)
replace_once(
    'src/components/AccentFlashControls.tsx',
    '<input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />',
    '<input aria-label={toggleLabel} type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />',
)

replace_once(
    'src/pages/MetronomePage.tsx',
    "<AccentFlashControls\n              enabled={accentFlashEnabled}\n              settings={accentFlash}",
    "<AccentFlashControls\n              enabled={accentFlashEnabled}\n              toggleLabel=\"강세 플래시\"\n              settings={accentFlash}",
)
replace_once(
    'src/pages/DrummerTrainingPage.tsx',
    "<AccentFlashControls\n            enabled={accentFlashEnabled}\n            settings={accentFlash}",
    "<AccentFlashControls\n            enabled={accentFlashEnabled}\n            toggleLabel=\"강세 화면 플래시\"\n            settings={accentFlash}",
)

replace_once(
    'src/components/DrummerTrainingSuite.tsx',
    "function countLabel(index: number): string {\n  const beat = Math.floor(index / 4) + 1;\n  const subdivision = [String(beat), 'e', '&', 'a'][index % 4];\n  return index % 4 === 0 ? subdivision : `${beat} ${subdivision}`;\n}",
    "function countLabel(index: number): string {\n  const beat = Math.floor(index / 4) + 1;\n  return [String(beat), 'e', '&', 'a'][index % 4];\n}",
)

css_path = Path('src/accent-flash-enhanced.css')
css = css_path.read_text(encoding='utf-8')
css += r'''

/* Prevent intrinsic form widths from pushing the customization card outside iPad layouts. */
.accent-flash-panel,
.training-accent-settings,
.accent-flash-controls,
.accent-option-grid,
.accent-option-group,
.accent-tone-options,
.accent-range-option,
.accent-duration-option,
.accent-detail-options {
  min-width: 0;
}
.accent-flash-panel,
.training-accent-settings { overflow: hidden; }
.accent-option-grid > *,
.accent-style-tabs > *,
.accent-tone-options > * { min-width: 0; }
.accent-duration-option select { width: 100%; min-width: 0; max-width: 100%; }
.accent-style-tabs button,
.accent-tone-options button { overflow-wrap: anywhere; }

@media (max-width: 1250px) {
  .accent-option-grid { grid-template-columns: 1fr; }
  .accent-style-tabs,
  .accent-tone-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
'''
css_path.write_text(css, encoding='utf-8')

Path('e2e/accent-flash.spec.ts').write_text(r'''import { expect, test } from '@playwright/test';

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
''', encoding='utf-8')

controls_test = Path('e2e/accent-flash-controls.spec.ts')
text = controls_test.read_text(encoding='utf-8')
text = text.replace('/하이햇 1 & 8분 엇박 강세/', '/하이햇 & 8분 엇박 강세/')
controls_test.write_text(text, encoding='utf-8')
