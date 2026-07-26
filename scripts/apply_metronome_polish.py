from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'missing marker: {label}')
    return text.replace(old, new, 1)


engine_path = Path('src/lib/standaloneMetronome.ts')
engine = engine_path.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "import type { DrumInstrument, DrumPattern } from './drummerPractice';",
    "import { DRUM_INSTRUMENT_IDS, type DrumInstrument, type DrumPattern } from './drummerPractice';",
    'engine instrument import',
)
engine = replace_once(
    engine,
    "export type MetronomeSound = 'classic' | 'wood' | 'rim' | 'cowbell';",
    "export type MetronomeSound = 'classic' | 'wood' | 'rim' | 'cowbell' | 'digital' | 'clave' | 'shaker' | 'low';",
    'metronome sound union',
)
engine = replace_once(
    engine,
    "    const instruments: DrumInstrument[] = ['kick', 'snare', 'hihat'];\n    let sounded = false;\n    instruments.forEach((instrument) => {",
    "    const instruments: DrumInstrument[] = DRUM_INSTRUMENT_IDS;\n    let sounded = false;\n    instruments.forEach((instrument) => {",
    'drum instrument scheduler',
)
old_voice = """    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const level = clamp(volume, 0, 1) * (accent ? 0.9 : 0.58);
    const decay = instrument === 'hihat' ? 0.035 : instrument === 'snare' ? 0.07 : 0.11;

    oscillator.type = instrument === 'hihat' ? 'square' : instrument === 'snare' ? 'triangle' : 'sine';
    if (instrument === 'kick') {
      oscillator.frequency.setValueAtTime(accent ? 170 : 135, when);
      oscillator.frequency.exponentialRampToValueAtTime(48, when + decay);
    } else if (instrument === 'snare') {
      oscillator.frequency.setValueAtTime(accent ? 245 : 195, when);
    } else {
      oscillator.frequency.setValueAtTime(accent ? 7200 : 5800, when);
    }
"""
new_voice = """    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const level = clamp(volume, 0, 1) * (accent ? 0.9 : 0.58);
    const decayByInstrument: Record<DrumInstrument, number> = {
      crash: 0.18,
      ride: 0.13,
      hihat: 0.035,
      rackTom: 0.13,
      floorTom: 0.16,
      snare: 0.07,
      kick: 0.11,
    };
    const decay = decayByInstrument[instrument];

    oscillator.type = instrument === 'hihat' || instrument === 'crash'
      ? 'square'
      : instrument === 'ride' || instrument === 'snare'
        ? 'triangle'
        : 'sine';
    if (instrument === 'kick') {
      oscillator.frequency.setValueAtTime(accent ? 175 : 138, when);
      oscillator.frequency.exponentialRampToValueAtTime(46, when + decay);
    } else if (instrument === 'floorTom') {
      oscillator.frequency.setValueAtTime(accent ? 155 : 132, when);
      oscillator.frequency.exponentialRampToValueAtTime(72, when + decay);
    } else if (instrument === 'rackTom') {
      oscillator.frequency.setValueAtTime(accent ? 235 : 205, when);
      oscillator.frequency.exponentialRampToValueAtTime(118, when + decay);
    } else if (instrument === 'snare') {
      oscillator.frequency.setValueAtTime(accent ? 255 : 205, when);
    } else if (instrument === 'ride') {
      oscillator.frequency.setValueAtTime(accent ? 2350 : 1900, when);
    } else if (instrument === 'crash') {
      oscillator.frequency.setValueAtTime(accent ? 4100 : 3350, when);
    } else {
      oscillator.frequency.setValueAtTime(accent ? 7600 : 6100, when);
    }
"""
engine = replace_once(engine, old_voice, new_voice, 'four-piece drum voice')
old_click = """    oscillator.type = sound === 'rim' ? 'square' : sound === 'cowbell' ? 'triangle' : 'sine';
    const baseFrequency =
      sound === 'wood' ? 820 : sound === 'rim' ? 1160 : sound === 'cowbell' ? 560 : 1040;
    oscillator.frequency.setValueAtTime(
      accent ? baseFrequency * 1.45 : secondary ? baseFrequency * 0.72 : baseFrequency,
      when,
    );

    const volume = accent
      ? settings.accentVolume
      : secondary
        ? settings.subdivisionVolume
        : settings.volume;
    const level = clamp(volume, 0, 1) * (accent ? 0.95 : secondary ? 0.45 : 0.72);
    const decay = sound === 'cowbell' ? 0.09 : secondary ? 0.032 : 0.055;
"""
new_click = """    const soundConfig: Record<MetronomeSound, { type: OscillatorType; frequency: number; decay: number }> = {
      classic: { type: 'sine', frequency: 1040, decay: 0.055 },
      wood: { type: 'sine', frequency: 820, decay: 0.06 },
      rim: { type: 'square', frequency: 1160, decay: 0.04 },
      cowbell: { type: 'triangle', frequency: 560, decay: 0.09 },
      digital: { type: 'square', frequency: 1480, decay: 0.027 },
      clave: { type: 'triangle', frequency: 1780, decay: 0.042 },
      shaker: { type: 'sawtooth', frequency: 6200, decay: 0.024 },
      low: { type: 'sine', frequency: 320, decay: 0.078 },
    };
    const config = soundConfig[sound];
    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(
      accent ? config.frequency * 1.45 : secondary ? config.frequency * 0.72 : config.frequency,
      when,
    );

    const volume = accent
      ? settings.accentVolume
      : secondary
        ? settings.subdivisionVolume
        : settings.volume;
    const level = clamp(volume, 0, 1) * (accent ? 0.95 : secondary ? 0.45 : 0.72);
    const decay = secondary ? Math.min(config.decay, 0.032) : config.decay;
"""
engine = replace_once(engine, old_click, new_click, 'expanded click sounds')
engine_path.write_text(engine, encoding='utf-8')

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "  const [firstDownbeat, setFirstDownbeat] = useState(0);\n  const [bars, setBars] = useState<BarSegment[]>([]);",
    "  const [firstDownbeat, setFirstDownbeat] = useState(0);\n  const [firstDownbeatInput, setFirstDownbeatInput] = useState('0.00');\n  const [bars, setBars] = useState<BarSegment[]>([]);",
    'downbeat input state',
)
app = replace_once(
    app,
    """  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  const resetPlaybackState = useCallback(() => {
""",
    """  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  const setDownbeatValue = (value: number) => {
    const safe = clamp(Number.isFinite(value) ? value : 0, 0, duration || 0);
    setFirstDownbeat(safe);
    setFirstDownbeatInput(safe.toFixed(2));
  };

  const commitDownbeatInput = () => {
    if (!firstDownbeatInput.trim()) {
      setFirstDownbeatInput(firstDownbeat.toFixed(2));
      return;
    }
    const parsed = Number(firstDownbeatInput.replace(',', '.'));
    setDownbeatValue(Number.isFinite(parsed) ? parsed : firstDownbeat);
  };

  const resetPlaybackState = useCallback(() => {
""",
    'downbeat input helpers',
)
app = app.replace("    setFirstDownbeat(0);\n    setBars([]);", "    setFirstDownbeat(0);\n    setFirstDownbeatInput('0.00');\n    setBars([]);")
app = app.replace("      setFirstDownbeat(mediaNow);", "      setDownbeatValue(mediaNow);")
app = app.replace("      if (isReady) setFirstDownbeat(tappedDownbeat);", "      if (isReady) setDownbeatValue(tappedDownbeat);")
app = app.replace("    setFirstDownbeat(0);\n    setBars([]);", "    setFirstDownbeat(0);\n    setFirstDownbeatInput('0.00');\n    setBars([]);")
old_downbeat = """<div className=\"field\"><div className=\"label-row\"><label htmlFor=\"downbeat\">첫 다운비트</label><button type=\"button\" className=\"text-button\" disabled={!isReady} onClick={() => setFirstDownbeat(currentTime)}>현재 위치</button></div><div className=\"stepper-row\"><button type=\"button\" disabled={!isReady} onClick={() => setFirstDownbeat((value) => clamp(value - 0.05, 0, duration))}>−0.05</button><input id=\"downbeat\" type=\"number\" min={0} max={duration || undefined} step={0.01} value={Number(firstDownbeat.toFixed(2))} onChange={(event) => setFirstDownbeat(clamp(Number(event.target.value), 0, duration || 0))} /><button type=\"button\" disabled={!isReady} onClick={() => setFirstDownbeat((value) => clamp(value + 0.05, 0, duration))}>+0.05</button><button type=\"button\" disabled={!isReady} onClick={() => seekTo(firstDownbeat)}>이동</button></div></div>"""
new_downbeat = """<div className=\"field\"><div className=\"label-row\"><label htmlFor=\"downbeat\">첫 다운비트</label><button type=\"button\" className=\"text-button\" disabled={!isReady} onClick={() => setDownbeatValue(currentTime)}>현재 위치</button></div><div className=\"stepper-row\"><button type=\"button\" disabled={!isReady} onClick={() => setDownbeatValue(firstDownbeat - 0.05)}>−0.05</button><input id=\"downbeat\" type=\"text\" inputMode=\"decimal\" value={firstDownbeatInput} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setFirstDownbeatInput(event.target.value.replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\\..*)\\./g, '$1'))} onBlur={commitDownbeatInput} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><button type=\"button\" disabled={!isReady} onClick={() => setDownbeatValue(firstDownbeat + 0.05)}>+0.05</button><button type=\"button\" disabled={!isReady} onClick={() => { commitDownbeatInput(); seekTo(firstDownbeat); }}>이동</button></div></div>"""
app = replace_once(app, old_downbeat, new_downbeat, 'downbeat text input')
app_path.write_text(app, encoding='utf-8')

css_path = Path('src/drummer-training-page.css')
css = css_path.read_text(encoding='utf-8')
css += """

.mode-launcher-group { position: fixed; z-index: 75; left: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); display: flex; gap: 8px; }
.mode-launcher-group .mode-launcher { position: static; min-height: 46px; padding: 0 16px; border: 1px solid var(--border); border-radius: 999px; background: #171b25; color: white; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-weight: 850; }
.mode-launcher-group .mode-launcher.training { background: #8b442d; border-color: #a95637; }
.metronome-page-nav { display: flex; flex-direction: column; gap: 7px; }
.beat-orbit { position: relative; overflow: visible; }
.metronome-flash { inset: -4px; }
@media (max-width: 700px) {
  .mode-launcher-group { left: 8px; right: 8px; bottom: calc(66px + env(safe-area-inset-bottom)); display: grid; grid-template-columns: 1fr 1fr; }
  .mode-launcher-group .mode-launcher { min-width: 0; padding-inline: 10px; font-size: .78rem; }
  .metronome-page-nav { flex-direction: row; }
}
"""
css_path.write_text(css, encoding='utf-8')

sw_path = Path('public/sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace("barloop-shell-v13", "barloop-shell-v14")
sw_path.write_text(sw, encoding='utf-8')

spec_path = Path('e2e/practice.spec.ts')
spec = spec_path.read_text(encoding='utf-8')
spec += """

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
"""
spec_path.write_text(spec, encoding='utf-8')
