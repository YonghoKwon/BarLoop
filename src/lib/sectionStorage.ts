import type { PracticeSection } from '../components/SectionPresetPanel';

const PREFIX = 'barloop:sections:v1:';

export function readSections(mediaKey: string): PracticeSection[] {
  if (!mediaKey) return [];
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${mediaKey}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as PracticeSection[]) : [];
  } catch {
    return [];
  }
}

export function writeSections(mediaKey: string, sections: PracticeSection[]): void {
  if (!mediaKey) return;
  try {
    window.localStorage.setItem(`${PREFIX}${mediaKey}`, JSON.stringify(sections));
  } catch {
    // Ignore storage quota and privacy-mode failures.
  }
}
