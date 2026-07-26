from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'Expected text not found in {path}: {old[:100]!r}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


Path('src/lib/accentFlash.ts').write_text(r'''import type { CSSProperties } from 'react';

export type AccentFlashStyle = 'minimal' | 'ring' | 'glow' | 'impact';
export type AccentFlashTone = 'amber' | 'mint' | 'violet' | 'ice';
export type AccentFlashDuration = 'short' | 'normal' | 'long';

export interface AccentFlashSettings {
  style: AccentFlashStyle;
  tone: AccentFlashTone;
  intensity: number;
  duration: AccentFlashDuration;
  screenEnabled: boolean;
  badgeEnabled: boolean;
}

export const DEFAULT_ACCENT_FLASH_SETTINGS: AccentFlashSettings = {
  style: 'ring',
  tone: 'ice',
  intensity: 62,
  duration: 'normal',
  screenEnabled: false,
  badgeEnabled: false,
};

const STYLE_VALUES: AccentFlashStyle[] = ['minimal', 'ring', 'glow', 'impact'];
const TONE_VALUES: AccentFlashTone[] = ['amber', 'mint', 'violet', 'ice'];
const DURATION_VALUES: AccentFlashDuration[] = ['short', 'normal', 'long'];

export function normalizeAccentFlashSettings(value: unknown): AccentFlashSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_ACCENT_FLASH_SETTINGS };
  const candidate = value as Partial<AccentFlashSettings>;
  return {
    style: STYLE_VALUES.includes(candidate.style as AccentFlashStyle)
      ? candidate.style as AccentFlashStyle
      : DEFAULT_ACCENT_FLASH_SETTINGS.style,
    tone: TONE_VALUES.includes(candidate.tone as AccentFlashTone)
      ? candidate.tone as AccentFlashTone
      : DEFAULT_ACCENT_FLASH_SETTINGS.tone,
    intensity: Math.min(100, Math.max(20, Math.round(Number(candidate.intensity) || DEFAULT_ACCENT_FLASH_SETTINGS.intensity))),
    duration: DURATION_VALUES.includes(candidate.duration as AccentFlashDuration)
      ? candidate.duration as AccentFlashDuration
      : DEFAULT_ACCENT_FLASH_SETTINGS.duration,
    screenEnabled: typeof candidate.screenEnabled === 'boolean'
      ? candidate.screenEnabled
      : DEFAULT_ACCENT_FLASH_SETTINGS.screenEnabled,
    badgeEnabled: typeof candidate.badgeEnabled === 'boolean'
      ? candidate.badgeEnabled
      : DEFAULT_ACCENT_FLASH_SETTINGS.badgeEnabled,
  };
}

export function accentFlashClassName(extraClass: string, settings: AccentFlashSettings): string {
  return [
    'accent-flash-wave',
    extraClass,
    `accent-style-${settings.style}`,
    `accent-tone-${settings.tone}`,
    settings.screenEnabled ? 'accent-screen-on' : 'accent-screen-off',
    settings.badgeEnabled ? 'accent-badge-on' : 'accent-badge-off',
  ].filter(Boolean).join(' ');
}

export function accentFlashInlineStyle(settings: AccentFlashSettings): CSSProperties {
  const power = Math.min(1, Math.max(.2, settings.intensity / 100));
  const duration = settings.duration === 'short' ? 280 : settings.duration === 'long' ? 720 : 480;
  return {
    '--flash-duration': `${duration}ms`,
    '--flash-power': String(power),
    '--flash-soft-alpha': String(.08 + power * .16),
    '--flash-mid-alpha': String(.16 + power * .28),
    '--flash-strong-alpha': String(.26 + power * .48),
    '--flash-expand': String(1.08 + power * .36),
  } as CSSProperties;
}

export const ACCENT_FLASH_STYLE_PRESETS: Record<AccentFlashStyle, Pick<AccentFlashSettings, 'screenEnabled' | 'badgeEnabled'>> = {
  minimal: { screenEnabled: false, badgeEnabled: false },
  ring: { screenEnabled: false, badgeEnabled: false },
  glow: { screenEnabled: true, badgeEnabled: false },
  impact: { screenEnabled: true, badgeEnabled: true },
};
''', encoding='utf-8')

Path('src/components/AccentFlashControls.tsx').write_text(r'''import {
  ACCENT_FLASH_STYLE_PRESETS,
  type AccentFlashDuration,
  type AccentFlashSettings,
  type AccentFlashStyle,
  type AccentFlashTone,
} from '../lib/accentFlash';

interface AccentFlashControlsProps {
  enabled: boolean;
  settings: AccentFlashSettings;
  onEnabledChange: (enabled: boolean) => void;
  onSettingsChange: (settings: AccentFlashSettings) => void;
  onPreview: () => void;
}

const STYLE_OPTIONS: Array<{ value: AccentFlashStyle; label: string; description: string }> = [
  { value: 'minimal', label: '미니멀', description: '숫자 주변만 짧게 밝아집니다.' },
  { value: 'ring', label: '모던 링', description: '얇은 이중 링이 깔끔하게 퍼집니다.' },
  { value: 'glow', label: '소프트 글로우', description: '배경까지 부드럽게 물듭니다.' },
  { value: 'impact', label: '임팩트', description: '화면 빛과 배지를 모두 사용합니다.' },
];

const TONE_OPTIONS: Array<{ value: AccentFlashTone; label: string }> = [
  { value: 'ice', label: '아이스' },
  { value: 'mint', label: '민트' },
  { value: 'violet', label: '바이올렛' },
  { value: 'amber', label: '앰버' },
];

export default function AccentFlashControls({
  enabled,
  settings,
  onEnabledChange,
  onSettingsChange,
  onPreview,
}: AccentFlashControlsProps) {
  const update = (patch: Partial<AccentFlashSettings>) => onSettingsChange({ ...settings, ...patch });
  const selectStyle = (style: AccentFlashStyle) => {
    update({ style, ...ACCENT_FLASH_STYLE_PRESETS[style] });
  };
  const selectedStyle = STYLE_OPTIONS.find((option) => option.value === settings.style) ?? STYLE_OPTIONS[1];

  return (
    <div className="accent-flash-controls" aria-label="강세 플래시 설정">
      <div className="accent-flash-control-header">
        <div>
          <span className="eyebrow">VISUAL ACCENT</span>
          <h2>강세 플래시</h2>
          <p>취향과 주변 밝기에 맞게 효과·색상·강도·길이를 조절합니다.</p>
        </div>
        <label className="switch-label accent-master-switch">
          <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
          <span>{enabled ? '사용 중' : '꺼짐'}</span>
        </label>
      </div>

      <div className="accent-option-group">
        <strong>효과 스타일</strong>
        <div className="accent-style-tabs" role="tablist" aria-label="강세 플래시 효과 스타일">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={settings.style === option.value}
              className={settings.style === option.value ? 'active' : ''}
              onClick={() => selectStyle(option.value)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <p className="accent-style-description">{selectedStyle.description}</p>
      </div>

      <div className="accent-option-grid">
        <div className="accent-option-group">
          <strong>색상</strong>
          <div className="accent-tone-options" aria-label="강세 플래시 색상">
            {TONE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`tone-${option.value} ${settings.tone === option.value ? 'active' : ''}`}
                aria-pressed={settings.tone === option.value}
                onClick={() => update({ tone: option.value })}
              >
                <i />{option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="accent-range-option">
          <span>강도 <strong>{settings.intensity}%</strong></span>
          <input
            aria-label="플래시 강도"
            type="range"
            min={20}
            max={100}
            step={5}
            value={settings.intensity}
            onChange={(event) => update({ intensity: Number(event.target.value) })}
          />
        </label>

        <label className="accent-duration-option">
          <span>표시 길이</span>
          <select
            aria-label="플래시 길이"
            value={settings.duration}
            onChange={(event) => update({ duration: event.target.value as AccentFlashDuration })}
          >
            <option value="short">짧게 · 0.28초</option>
            <option value="normal">보통 · 0.48초</option>
            <option value="long">길게 · 0.72초</option>
          </select>
        </label>
      </div>

      <div className="accent-detail-options">
        <label><input type="checkbox" checked={settings.screenEnabled} onChange={(event) => update({ screenEnabled: event.target.checked })} /><span>화면 전체 빛</span></label>
        <label><input type="checkbox" checked={settings.badgeEnabled} onChange={(event) => update({ badgeEnabled: event.target.checked })} /><span>ACCENT 배지</span></label>
        <button type="button" className="secondary-button accent-preview-button" onClick={onPreview}>미리보기</button>
      </div>
    </div>
  );
}
''', encoding='utf-8')

Path('src/accent-flash-enhanced.css').write_text(r'''/* Customizable, modern accent flash feedback. */
.accent-flash-wave {
  --flash-duration: 480ms;
  --flash-power: .62;
  --flash-soft-alpha: .18;
  --flash-mid-alpha: .34;
  --flash-strong-alpha: .56;
  --flash-expand: 1.3;
  --flash-rgb: 198 226 255;
  --flash-highlight: 244 251 255;
  position: absolute;
  z-index: 120;
  inset: -10px;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0;
  transform: scale(.84);
  will-change: transform, opacity, filter;
}
.accent-tone-ice { --flash-rgb: 151 205 255; --flash-highlight: 238 249 255; }
.accent-tone-mint { --flash-rgb: 78 224 177; --flash-highlight: 226 255 246; }
.accent-tone-violet { --flash-rgb: 164 137 255; --flash-highlight: 245 240 255; }
.accent-tone-amber { --flash-rgb: 255 174 87; --flash-highlight: 255 247 218; }

.accent-flash-wave::before,
.accent-flash-wave::after {
  pointer-events: none;
}
.accent-screen-off::before,
.accent-badge-off::after { display: none; }

.accent-screen-on::before {
  content: '';
  position: fixed;
  z-index: 998;
  inset: 0;
  background:
    radial-gradient(circle at 50% 42%, rgb(var(--flash-highlight) / var(--flash-mid-alpha)) 0%, rgb(var(--flash-rgb) / var(--flash-soft-alpha)) 32%, transparent 72%);
  box-shadow: inset 0 0 120px rgb(var(--flash-rgb) / var(--flash-soft-alpha));
  animation: accent-screen-fade var(--flash-duration) ease-out both;
}
.accent-badge-on::after {
  content: 'ACCENT';
  position: fixed;
  z-index: 999;
  top: max(18px, calc(env(safe-area-inset-top) + 10px));
  left: 50%;
  padding: 7px 14px 6px;
  border: 1px solid rgb(var(--flash-highlight) / .82);
  border-radius: 999px;
  background: rgb(11 16 25 / .82);
  color: rgb(var(--flash-highlight));
  box-shadow: 0 8px 28px rgb(0 0 0 / .34), 0 0 24px rgb(var(--flash-rgb) / var(--flash-mid-alpha));
  backdrop-filter: blur(12px);
  font-size: clamp(.7rem, 1.8vw, .86rem);
  font-style: normal;
  font-weight: 850;
  letter-spacing: .18em;
  transform: translate(-50%, -8px);
  animation: accent-badge-fade var(--flash-duration) cubic-bezier(.2,.7,.2,1) both;
}

.accent-style-minimal {
  inset: 18%;
  background: radial-gradient(circle, rgb(var(--flash-highlight) / var(--flash-strong-alpha)) 0%, rgb(var(--flash-rgb) / var(--flash-mid-alpha)) 38%, transparent 72%);
  filter: blur(2px);
  animation: accent-minimal-pulse var(--flash-duration) ease-out both;
}
.accent-style-ring {
  border: 2px solid rgb(var(--flash-highlight) / .92);
  outline: 1px solid rgb(var(--flash-rgb) / .68);
  outline-offset: 7px;
  box-shadow: 0 0 24px rgb(var(--flash-rgb) / var(--flash-mid-alpha)), inset 0 0 34px rgb(var(--flash-rgb) / var(--flash-soft-alpha));
  animation: accent-ring-clean var(--flash-duration) cubic-bezier(.16,.72,.24,1) both;
}
.accent-style-ring::marker { display: none; }
.accent-style-glow {
  inset: -4px;
  border: 1px solid rgb(var(--flash-highlight) / .64);
  background: radial-gradient(circle, rgb(var(--flash-highlight) / var(--flash-mid-alpha)) 0%, rgb(var(--flash-rgb) / var(--flash-soft-alpha)) 46%, transparent 74%);
  box-shadow: 0 0 46px rgb(var(--flash-rgb) / var(--flash-mid-alpha)), 0 0 92px rgb(var(--flash-rgb) / var(--flash-soft-alpha));
  filter: blur(.2px);
  animation: accent-glow-breathe var(--flash-duration) ease-out both;
}
.accent-style-impact {
  inset: -13px;
  border: 3px solid rgb(var(--flash-highlight) / .96);
  outline: 2px solid rgb(var(--flash-rgb) / .7);
  outline-offset: 8px;
  box-shadow: 0 0 30px rgb(var(--flash-highlight) / var(--flash-mid-alpha)), 0 0 78px rgb(var(--flash-rgb) / var(--flash-strong-alpha)), inset 0 0 60px rgb(var(--flash-rgb) / var(--flash-mid-alpha));
  animation: accent-impact-burst var(--flash-duration) cubic-bezier(.12,.72,.2,1) both;
}
.metronome-flash { inset: -12px; }
.metronome-flash.accent-style-minimal { inset: 18%; }
.metronome-flash.accent-style-glow { inset: -4px; }

@keyframes accent-minimal-pulse {
  0% { opacity: 0; transform: scale(.82); }
  22% { opacity: var(--flash-power); transform: scale(1); }
  100% { opacity: 0; transform: scale(1.08); }
}
@keyframes accent-ring-clean {
  0% { opacity: 0; transform: scale(.82); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: scale(var(--flash-expand)); outline-offset: 16px; }
}
@keyframes accent-glow-breathe {
  0% { opacity: 0; transform: scale(.88); }
  26% { opacity: var(--flash-power); transform: scale(1.02); }
  100% { opacity: 0; transform: scale(1.18); }
}
@keyframes accent-impact-burst {
  0% { opacity: 0; transform: scale(.7); }
  16% { opacity: 1; }
  44% { opacity: 1; transform: scale(1.03); }
  100% { opacity: 0; transform: scale(calc(var(--flash-expand) + .18)); outline-offset: 22px; }
}
@keyframes accent-screen-fade {
  0% { opacity: 0; }
  12% { opacity: var(--flash-power); }
  100% { opacity: 0; }
}
@keyframes accent-badge-fade {
  0% { opacity: 0; transform: translate(-50%, -8px) scale(.94); }
  22% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  72% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, 3px) scale(.98); }
}

.accent-flash-controls { display: grid; gap: 15px; min-width: 0; }
.accent-flash-control-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.accent-flash-control-header h2 { margin: 2px 0 5px; }
.accent-flash-control-header p { margin: 0; color: var(--text-muted); font-size: .78rem; line-height: 1.45; }
.accent-master-switch { flex: 0 0 auto; }
.accent-option-group { display: grid; gap: 8px; min-width: 0; }
.accent-option-group > strong { color: #dce3ef; font-size: .74rem; }
.accent-style-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
.accent-style-tabs button { min-width: 0; min-height: 44px; padding: 7px 8px; border: 1px solid #343d4e; border-radius: 11px; background: #141923; color: #aeb8c9; cursor: pointer; }
.accent-style-tabs button.active { border-color: #89bfff; background: rgba(112,177,255,.14); color: #fff; box-shadow: inset 0 0 0 1px rgba(137,191,255,.15); }
.accent-style-tabs span { font-weight: 800; }
.accent-style-description { margin: 0; color: #8995a9; font-size: .7rem; }
.accent-option-grid { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 10px; align-items: end; }
.accent-tone-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
.accent-tone-options button { min-width: 0; min-height: 38px; display: grid; grid-template-columns: 12px minmax(0,1fr); align-items: center; gap: 5px; padding: 5px 7px; border: 1px solid #343d4e; border-radius: 9px; background: #141923; color: #9ca7ba; font-size: .66rem; cursor: pointer; }
.accent-tone-options button.active { border-color: #dbeeff; color: #fff; }
.accent-tone-options i { width: 11px; height: 11px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
.accent-tone-options .tone-ice i { background: #97cdff; }
.accent-tone-options .tone-mint i { background: #4ee0b1; }
.accent-tone-options .tone-violet i { background: #a489ff; }
.accent-tone-options .tone-amber i { background: #ffae57; }
.accent-range-option, .accent-duration-option { min-width: 0; display: grid; gap: 7px; color: var(--text-muted); font-size: .7rem; }
.accent-range-option span { display: flex; justify-content: space-between; gap: 8px; }
.accent-range-option strong { color: #fff; }
.accent-duration-option select { width: 100%; }
.accent-detail-options { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.accent-detail-options label { min-height: 42px; display: inline-flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid #343d4e; border-radius: 10px; background: #141923; color: #aeb8c9; font-size: .7rem; }
.accent-detail-options input { width: 18px; height: 18px; }
.accent-preview-button { margin-left: auto; min-height: 42px; }
.training-accent-settings { grid-column: 2; min-width: 0; }

@media (max-width: 900px) {
  .training-accent-settings { grid-column: 1; }
}
@media (max-width: 700px) {
  .accent-option-grid { grid-template-columns: 1fr; }
  .accent-style-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .accent-preview-button { width: 100%; margin-left: 0; }
}
@media (max-width: 430px) {
  .accent-flash-control-header { flex-direction: column; align-items: stretch; }
  .accent-tone-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .accent-badge-on::after { top: max(12px, calc(env(safe-area-inset-top) + 6px)); font-size: .68rem; }
}
@media (prefers-reduced-motion: reduce) {
  .accent-flash-wave,
  .accent-flash-wave::before,
  .accent-flash-wave::after { animation-name: accent-reduced-fade !important; transform: none !important; }
}
@keyframes accent-reduced-fade {
  0% { opacity: var(--flash-power); }
  100% { opacity: 0; }
}
''', encoding='utf-8')

# Metronome page
replace_once('src/pages/MetronomePage.tsx',
    "import BpmNumberInput from '../components/BpmNumberInput';\n",
    "import AccentFlashControls from '../components/AccentFlashControls';\nimport BpmNumberInput from '../components/BpmNumberInput';\n")
replace_once('src/pages/MetronomePage.tsx',
    "import { preparePlaybackAudioSession, releasePlaybackAudioSession } from '../lib/audioPlaybackSession';\n",
    "import { preparePlaybackAudioSession, releasePlaybackAudioSession } from '../lib/audioPlaybackSession';\nimport {\n  DEFAULT_ACCENT_FLASH_SETTINGS,\n  accentFlashClassName,\n  accentFlashInlineStyle,\n  normalizeAccentFlashSettings,\n  type AccentFlashSettings,\n} from '../lib/accentFlash';\n")
replace_once('src/pages/MetronomePage.tsx',
    "  accentFlashEnabled: boolean;\n}",
    "  accentFlashEnabled: boolean;\n  accentFlash: AccentFlashSettings;\n}")
replace_once('src/pages/MetronomePage.tsx',
    "  accentFlashEnabled: true,\n};",
    "  accentFlashEnabled: true,\n  accentFlash: DEFAULT_ACCENT_FLASH_SETTINGS,\n};")
replace_once('src/pages/MetronomePage.tsx',
    "      accentFlashEnabled: stored.accentFlashEnabled !== false,\n",
    "      accentFlashEnabled: stored.accentFlashEnabled !== false,\n      accentFlash: normalizeAccentFlashSettings(stored.accentFlash),\n")
replace_once('src/pages/MetronomePage.tsx',
    "  const [accentFlashEnabled, setAccentFlashEnabled] = useState(initial.accentFlashEnabled);\n",
    "  const [accentFlashEnabled, setAccentFlashEnabled] = useState(initial.accentFlashEnabled);\n  const [accentFlash, setAccentFlash] = useState<AccentFlashSettings>(normalizeAccentFlashSettings(initial.accentFlash));\n")
replace_once('src/pages/MetronomePage.tsx',
    "      accentFlashEnabled,\n    }));\n  }, [accentFlashEnabled, countMode, presetIndex, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget]);",
    "      accentFlashEnabled,\n      accentFlash,\n    }));\n  }, [accentFlash, accentFlashEnabled, countMode, presetIndex, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget]);")
replace_once('src/pages/MetronomePage.tsx',
    "{accentFlashEnabled && flashPulse > 0 && <i key={flashPulse} className=\"accent-flash-wave metronome-flash\" />}",
    "{accentFlashEnabled && flashPulse > 0 && <i key={flashPulse} data-testid=\"accent-flash-effect\" className={accentFlashClassName('metronome-flash', accentFlash)} style={accentFlashInlineStyle(accentFlash)} />}"
)
replace_once('src/pages/MetronomePage.tsx',
    "<div className=\"section-title-row\"><h2>박자와 악센트</h2><label className=\"switch-label\"><input type=\"checkbox\" checked={accentFlashEnabled} onChange={(event) => setAccentFlashEnabled(event.target.checked)} /><span>강세 플래시</span></label></div>",
    "<div className=\"section-title-row\"><h2>박자와 악센트</h2><span>{beatsPerBar}/4</span></div>"
)
replace_once('src/pages/MetronomePage.tsx',
    "          </section>\n\n          <section className=\"panel lab-panel\">\n            <div className=\"section-title-row\"><h2>오디오 믹서</h2><span>{selectedSound.label}</span></div>",
    "          </section>\n\n          <section className=\"panel lab-panel accent-flash-panel\">\n            <AccentFlashControls\n              enabled={accentFlashEnabled}\n              settings={accentFlash}\n              onEnabledChange={setAccentFlashEnabled}\n              onSettingsChange={setAccentFlash}\n              onPreview={() => { setAccentFlashEnabled(true); setFlashPulse((value) => value + 1); }}\n            />\n          </section>\n\n          <section className=\"panel lab-panel\">\n            <div className=\"section-title-row\"><h2>오디오 믹서</h2><span>{selectedSound.label}</span></div>"
)

# Drummer training page
replace_once('src/pages/DrummerTrainingPage.tsx',
    "import BpmNumberInput from '../components/BpmNumberInput';\n",
    "import AccentFlashControls from '../components/AccentFlashControls';\nimport BpmNumberInput from '../components/BpmNumberInput';\n")
replace_once('src/pages/DrummerTrainingPage.tsx',
    "import { preparePlaybackAudioSession, releasePlaybackAudioSession } from '../lib/audioPlaybackSession';\n",
    "import { preparePlaybackAudioSession, releasePlaybackAudioSession } from '../lib/audioPlaybackSession';\nimport {\n  DEFAULT_ACCENT_FLASH_SETTINGS,\n  accentFlashClassName,\n  accentFlashInlineStyle,\n  normalizeAccentFlashSettings,\n  type AccentFlashSettings,\n} from '../lib/accentFlash';\n")
replace_once('src/pages/DrummerTrainingPage.tsx',
    "  accentFlashEnabled: boolean;\n}",
    "  accentFlashEnabled: boolean;\n  accentFlash: AccentFlashSettings;\n}")
replace_once('src/pages/DrummerTrainingPage.tsx',
    "  accentFlashEnabled: true,\n};",
    "  accentFlashEnabled: true,\n  accentFlash: DEFAULT_ACCENT_FLASH_SETTINGS,\n};")
replace_once('src/pages/DrummerTrainingPage.tsx',
    "      accentFlashEnabled: stored.accentFlashEnabled !== false,\n",
    "      accentFlashEnabled: stored.accentFlashEnabled !== false,\n      accentFlash: normalizeAccentFlashSettings(stored.accentFlash),\n")
replace_once('src/pages/DrummerTrainingPage.tsx',
    "  const [accentFlashEnabled, setAccentFlashEnabled] = useState(initial.accentFlashEnabled);\n",
    "  const [accentFlashEnabled, setAccentFlashEnabled] = useState(initial.accentFlashEnabled);\n  const [accentFlash, setAccentFlash] = useState<AccentFlashSettings>(normalizeAccentFlashSettings(initial.accentFlash));\n")
replace_once('src/pages/DrummerTrainingPage.tsx',
    "      accentFlashEnabled,\n    }));\n  }, [accentEveryBars, accentFlashEnabled, accentMode, accentTrainerEnabled, bpm, movingAccentStep, pattern, rhythmEnabled, routineSteps, volume]);",
    "      accentFlashEnabled,\n      accentFlash,\n    }));\n  }, [accentEveryBars, accentFlash, accentFlashEnabled, accentMode, accentTrainerEnabled, bpm, movingAccentStep, pattern, rhythmEnabled, routineSteps, volume]);")
replace_once('src/pages/DrummerTrainingPage.tsx',
    "{accentFlashEnabled && flashPulse > 0 && <i key={flashPulse} className=\"accent-flash-wave\" />}",
    "{accentFlashEnabled && flashPulse > 0 && <i key={flashPulse} data-testid=\"accent-flash-effect\" className={accentFlashClassName('', accentFlash)} style={accentFlashInlineStyle(accentFlash)} />}"
)
replace_once('src/pages/DrummerTrainingPage.tsx',
    "return <span key={`${beatIndex}-${label}`} className={[subIndex > 0 ? 'offbeat' : 'downbeat', step === activeStep ? 'active' : ''].filter(Boolean).join(' ')}>{label}</span>;",
    "return <span key={`${beatIndex}-${label}`} className={[subIndex === 0 ? 'downbeat' : subIndex === 2 ? 'eighth-offbeat' : 'sixteenth-between', step === activeStep ? 'active' : ''].filter(Boolean).join(' ')}>{label}</span>;"
)
replace_once('src/pages/DrummerTrainingPage.tsx',
    "          <div className=\"compact-grid four training-settings-grid\">",
    "          <div className=\"compact-grid three training-settings-grid\">"
)
replace_once('src/pages/DrummerTrainingPage.tsx',
    "            <label className=\"flash-toggle-card\"><span>강세 화면 플래시</span><input type=\"checkbox\" checked={accentFlashEnabled} onChange={(event) => setAccentFlashEnabled(event.target.checked)} /></label>\n",
    "")
replace_once('src/pages/DrummerTrainingPage.tsx',
    "        </section>\n\n        <DrummerTrainingSuite",
    "        </section>\n\n        <section className=\"panel training-accent-settings\">\n          <AccentFlashControls\n            enabled={accentFlashEnabled}\n            settings={accentFlash}\n            onEnabledChange={setAccentFlashEnabled}\n            onSettingsChange={setAccentFlash}\n            onPreview={() => { setAccentFlashEnabled(true); setFlashPulse((value) => value + 1); }}\n          />\n        </section>\n\n        <DrummerTrainingSuite"
)

# Clearer syncopation education and hierarchy
replace_once('src/components/DrummerTrainingSuite.tsx',
    "const SUBDIVISION_LABELS = ['숫자', 'e', '&', 'a'];",
    "const SUBDIVISION_LABELS = ['정박', 'e', '&', 'a'];")
replace_once('src/components/DrummerTrainingSuite.tsx',
    "  return [String(beat), 'e', '&', 'a'][index % 4];",
    "  const subdivision = [String(beat), 'e', '&', 'a'][index % 4];\n  return index % 4 === 0 ? subdivision : `${beat} ${subdivision}`;"
)
replace_once('src/components/DrummerTrainingSuite.tsx',
    "            <span>숫자 박이 아닌 e·&·a 위치를 자동 배치한 뒤 각 칸을 자유롭게 수정할 수 있습니다.</span>",
    "            <span>&는 박과 박 사이의 8분 엇박이고, e·a는 그보다 더 잘게 나눈 16분 사이 위치입니다. 정박 악기를 남겨 두는 것은 박을 잃지 않기 위한 기준점입니다.</span>"
)
replace_once('src/components/DrummerTrainingSuite.tsx',
    "        </div>\n\n        <div className=\"sequencer-legend\" aria-hidden=\"true\">",
    "        </div>\n\n        <div className=\"syncopation-explainer\" aria-label=\"엇박 이해하기\">\n          <div className=\"downbeat-card\"><strong>1 · 2 · 3 · 4</strong><span>정박 · 숫자를 세는 기본 박</span></div>\n          <div className=\"eighth-card\"><strong>1 & 2 & 3 & 4 &</strong><span>8분 엇박 · 각 박의 정확한 중간</span></div>\n          <div className=\"sixteenth-card\"><strong>1 e & a</strong><span>16분 사이 · e와 a는 더 세밀한 싱코페이션 위치</span></div>\n        </div>\n\n        <div className=\"sequencer-legend\" aria-hidden=\"true\">"
)
replace_once('src/components/DrummerTrainingSuite.tsx',
    "          <span><i className=\"legend-dot offbeat\" />엇박 위치</span>",
    "          <span><i className=\"legend-dot downbeat\" />정박·숫자</span>\n          <span><i className=\"legend-dot eighth-offbeat\" />8분 엇박·&</span>\n          <span><i className=\"legend-dot sixteenth-between\" />16분 사이·e/a</span>"
)
replace_once('src/components/DrummerTrainingSuite.tsx',
    "<span key={labelText} className={subIndex > 0 ? 'offbeat-label' : ''}>{subIndex === 0 ? beatIndex + 1 : labelText}</span>",
    "<span key={labelText} className={subIndex === 0 ? 'downbeat-label' : subIndex === 2 ? 'eighth-offbeat-label' : 'sixteenth-between-label'}>{subIndex === 0 ? beatIndex + 1 : labelText}</span>"
)
replace_once('src/components/DrummerTrainingSuite.tsx',
    "                              subIndex > 0 ? 'offbeat-cell' : 'downbeat-cell',\n                              subIndex === 2 ? 'ampersand-cell' : '',",
    "                              subIndex === 0 ? 'downbeat-cell' : subIndex === 2 ? 'eighth-offbeat-cell' : 'sixteenth-between-cell',"
)
replace_once('src/components/DrummerTrainingSuite.tsx',
    "aria-label={`${label} ${countLabel(stepIndex)} ${subIndex > 0 ? '엇박' : '정박'} ${level === 2 ? '강세' : level === 1 ? '일반' : '무음'}`}",
    "aria-label={`${label} ${countLabel(stepIndex)} ${subIndex === 0 ? '정박' : subIndex === 2 ? '8분 엇박' : '16분 사이'} ${level === 2 ? '강세' : level === 1 ? '일반' : '무음'}`}"
)

# Append hierarchy styles for syncopation.
variable_css = Path('src/variable-meter.css').read_text(encoding='utf-8')
variable_css += r'''

/* Clear hierarchy: downbeat -> eighth-note offbeat (&) -> sixteenth-note in-between (e/a). */
.syncopation-explainer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  margin: 0 0 12px;
}
.syncopation-explainer > div {
  min-width: 0;
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid #343d4e;
  border-radius: 11px;
  background: #111620;
}
.syncopation-explainer strong { font: 800 .78rem ui-monospace, SFMono-Regular, Menlo, monospace; }
.syncopation-explainer span { color: #8f9caf; font-size: .66rem; line-height: 1.4; }
.syncopation-explainer .downbeat-card { border-left: 3px solid #ff8f66; }
.syncopation-explainer .eighth-card { border-left: 3px solid #5aa6ff; background: rgba(75,145,255,.08); }
.syncopation-explainer .sixteenth-card { border-left: 3px solid #69778d; }
.legend-dot.downbeat { background: #ff8f66; }
.legend-dot.eighth-offbeat { background: #5aa6ff; box-shadow: 0 0 8px rgba(90,166,255,.45); }
.legend-dot.sixteenth-between { border: 1px dashed #69778d; background: rgba(105,119,141,.14); }
.drum-substep-labels span.downbeat-label { color: #f0a186; }
.drum-substep-labels span.eighth-offbeat-label { color: #75b7ff; font-weight: 900; }
.drum-substep-labels span.sixteenth-between-label { color: #7e8b9e; }
.drum-substep-grid button.eighth-offbeat-cell:not(.on):not(.accent) {
  border-color: rgba(90,166,255,.68);
  background: rgba(75,145,255,.14);
}
.drum-substep-grid button.sixteenth-between-cell:not(.on):not(.accent) {
  border-style: dashed;
  border-color: #35445a;
  background: #151c27;
}
.training-measure-guide span.eighth-offbeat:not(.active) {
  background: rgba(75,145,255,.16);
  color: #83bdff;
  font-weight: 900;
}
.training-measure-guide span.sixteenth-between:not(.active) {
  background: rgba(54,66,84,.24);
  color: #7e8b9e;
}
@media (max-width: 760px) {
  .syncopation-explainer { grid-template-columns: 1fr; }
}
'''
Path('src/variable-meter.css').write_text(variable_css, encoding='utf-8')

# Service worker cache and tests.
replace_once('public/sw.js', "const CACHE_NAME = 'barloop-shell-v16';", "const CACHE_NAME = 'barloop-shell-v17';")

Path('e2e/accent-flash-controls.spec.ts').write_text(r'''import { expect, test, type Page } from '@playwright/test';

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
  await controls.getByLabel('플래시 강도').fill('45');
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
''', encoding='utf-8')
