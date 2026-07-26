import {
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
