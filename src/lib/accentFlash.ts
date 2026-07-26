import type { CSSProperties } from 'react';

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
