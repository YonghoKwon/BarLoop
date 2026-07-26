from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing patch target: {label}")
    return text.replace(old, new, 1)


helper = """import type { MetronomeSubdivision } from './standaloneMetronome';

const SUBDIVISION_TOKENS: Record<MetronomeSubdivision, readonly string[]> = {
  1: [''],
  2: ['', '&'],
  3: ['', 'trip', 'let'],
  4: ['', 'e', '&', 'a'],
};

export function getVisualSubdivision(
  playbackSubdivision: MetronomeSubdivision,
): MetronomeSubdivision {
  return playbackSubdivision === 3 ? 3 : 4;
}

export function getSubdivisionCountGroup(
  beatIndex: number,
  subdivision: MetronomeSubdivision,
): string[] {
  return SUBDIVISION_TOKENS[subdivision].map((token, subdivisionIndex) =>
    subdivisionIndex === 0 ? String(beatIndex + 1) : token,
  );
}

export function buildSubdivisionCountGroups(
  beatsPerBar: number,
  subdivision: MetronomeSubdivision,
): string[][] {
  return Array.from({ length: Math.max(1, beatsPerBar) }, (_, beatIndex) =>
    getSubdivisionCountGroup(beatIndex, subdivision),
  );
}

export function getCurrentSubdivisionCount(
  beatIndex: number,
  subdivisionIndex: number,
  subdivision: MetronomeSubdivision,
): string {
  const group = getSubdivisionCountGroup(beatIndex, subdivision);
  const token = group[Math.min(group.length - 1, Math.max(0, subdivisionIndex))];
  return subdivisionIndex === 0 ? token : `${beatIndex + 1} ${token}`;
}

export function getVisualSubdivisionIndex(
  playbackSubdivision: MetronomeSubdivision,
  playbackSubdivisionIndex: number,
): number {
  if (playbackSubdivision === 2) return playbackSubdivisionIndex * 2;
  return playbackSubdivisionIndex;
}

export function isSubdivisionSoundCell(
  playbackSubdivision: MetronomeSubdivision,
  visualSubdivisionIndex: number,
): boolean {
  if (playbackSubdivision === 1) return visualSubdivisionIndex === 0;
  if (playbackSubdivision === 2) return visualSubdivisionIndex === 0 || visualSubdivisionIndex === 2;
  return visualSubdivisionIndex < playbackSubdivision;
}
"""

helper_test = """import { describe, expect, it } from 'vitest';
import {
  buildSubdivisionCountGroups,
  getCurrentSubdivisionCount,
  getSubdivisionCountGroup,
  getVisualSubdivision,
  getVisualSubdivisionIndex,
  isSubdivisionSoundCell,
} from './subdivisionCount';

describe('subdivision count labels', () => {
  it('builds sixteenth-note counting as 1 e & a', () => {
    expect(getSubdivisionCountGroup(0, 4)).toEqual(['1', 'e', '&', 'a']);
    expect(getSubdivisionCountGroup(1, 4)).toEqual(['2', 'e', '&', 'a']);
  });

  it('supports eighth notes and triplets', () => {
    expect(getSubdivisionCountGroup(0, 2)).toEqual(['1', '&']);
    expect(getSubdivisionCountGroup(0, 3)).toEqual(['1', 'trip', 'let']);
  });

  it('builds a full measure and reports the current position', () => {
    expect(buildSubdivisionCountGroups(2, 4)).toEqual([
      ['1', 'e', '&', 'a'],
      ['2', 'e', '&', 'a'],
    ]);
    expect(getCurrentSubdivisionCount(2, 1, 4)).toBe('3 e');
    expect(getCurrentSubdivisionCount(2, 2, 4)).toBe('3 &');
    expect(getCurrentSubdivisionCount(2, 3, 4)).toBe('3 a');
  });

  it('keeps a sixteenth-note visual grid for quarter and eighth-note clicks', () => {
    expect(getVisualSubdivision(1)).toBe(4);
    expect(getVisualSubdivision(2)).toBe(4);
    expect(getVisualSubdivision(3)).toBe(3);
    expect(getVisualSubdivision(4)).toBe(4);
  });

  it('marks the cells that actually produce sound', () => {
    expect([0, 1, 2, 3].map((index) => isSubdivisionSoundCell(1, index))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect([0, 1, 2, 3].map((index) => isSubdivisionSoundCell(2, index))).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect([0, 1, 2, 3].map((index) => isSubdivisionSoundCell(4, index))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(getVisualSubdivisionIndex(2, 1)).toBe(2);
  });
});
"""

Path('src/lib/subdivisionCount.ts').write_text(helper)
Path('src/lib/subdivisionCount.test.ts').write_text(helper_test)

page_path = Path('src/pages/MetronomeLabPage.tsx')
page = page_path.read_text()
page = replace_once(
    page,
    "import { buildSubdivisionCountGroups, getCurrentSubdivisionCount } from '../lib/subdivisionCount';",
    """import {
  buildSubdivisionCountGroups,
  getCurrentSubdivisionCount,
  getVisualSubdivision,
  getVisualSubdivisionIndex,
  isSubdivisionSoundCell,
} from '../lib/subdivisionCount';""",
    'subdivision imports',
)
page = replace_once(
    page,
    """  const subdivisionCountGroups = useMemo(
    () => buildSubdivisionCountGroups(beatsPerBar, subdivision),
    [beatsPerBar, subdivision],
  );
  const currentSubdivisionCount = getCurrentSubdivisionCount(
    beatInBar,
    subdivisionInBeat,
    subdivision,
  );
""",
    """  const visualSubdivision = getVisualSubdivision(subdivision);
  const subdivisionCountGroups = useMemo(
    () => buildSubdivisionCountGroups(beatsPerBar, visualSubdivision),
    [beatsPerBar, visualSubdivision],
  );
  const currentSubdivisionCount = getCurrentSubdivisionCount(
    beatInBar,
    subdivisionInBeat,
    subdivision,
  );
  const activeVisualSubdivisionIndex = getVisualSubdivisionIndex(
    subdivision,
    subdivisionInBeat,
  );
""",
    'subdivision guide values',
)
page = replace_once(
    page,
    """                {labels.map((label, countSubdivisionIndex) => (
                  <span
                    key={`${countBeatIndex}-${countSubdivisionIndex}`}
                    className={
                      countBeatIndex === beatInBar && countSubdivisionIndex === subdivisionInBeat
                        ? 'active'
                        : ''
                    }
                  >
                    {label}
                  </span>
                ))}
""",
    """                {labels.map((label, countSubdivisionIndex) => (
                  <span
                    key={`${countBeatIndex}-${countSubdivisionIndex}`}
                    className={[
                      isSubdivisionSoundCell(subdivision, countSubdivisionIndex)
                        ? 'sound-on'
                        : 'guide-only',
                      countBeatIndex === beatInBar &&
                      countSubdivisionIndex === activeVisualSubdivisionIndex
                        ? 'active'
                        : '',
                    ].filter(Boolean).join(' ')}
                    title={
                      isSubdivisionSoundCell(subdivision, countSubdivisionIndex)
                        ? '실제 클릭이 나는 위치'
                        : '소리 없이 박을 나누어 보는 안내 위치'
                    }
                  >
                    {label}
                  </span>
                ))}
""",
    'subdivision guide cells',
)
page = replace_once(
    page,
    """            {subdivision === 4
              ? '16분음표: 1 e & a'
              : subdivision === 3
                ? '셋잇단: 1 trip let'
                : subdivision === 2
                  ? '8분음표: 1 &'
                  : '4분음표: 1 2 3 4'}
""",
    """            {subdivision === 4
              ? '16분음표 클릭 · 모든 1 e & a 칸에서 소리'
              : subdivision === 3
                ? '셋잇단 클릭 · 1 trip let 세 칸으로 표시'
                : subdivision === 2
                  ? '8분음표 클릭 · 16분 격자에서 숫자와 & 칸에 소리'
                  : '4분음표 클릭 · 16분 격자는 보이지만 숫자 칸에서만 소리'}
""",
    'subdivision guide hint',
)
page_path.write_text(page)

css_path = Path('src/metronome-lab.css')
css = css_path.read_text()
css = replace_once(
    css,
    """  font-weight: 800;
  transition: transform .08s ease, background .08s ease, color .08s ease;
}

.count-beat-group span:first-child {
  color: #d9def0;
}

.count-beat-group span.active {
""",
    """  position: relative;
  padding-bottom: 13px;
  font-weight: 800;
  transition: transform .08s ease, background .08s ease, color .08s ease, opacity .08s ease;
}

.count-beat-group span::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transform: translateX(-50%);
}

.count-beat-group span.sound-on {
  color: #d9def0;
  background: rgba(119, 103, 255, .12);
}

.count-beat-group span.sound-on::after {
  background: #8f80ff;
}

.count-beat-group span.guide-only {
  color: #788397;
  opacity: .72;
}

.count-beat-group span.guide-only::after {
  border: 1px solid #697386;
  background: transparent;
}

.count-beat-group span.active {
""",
    'sound and guide cell styles',
)
css = replace_once(
    css,
    """  box-shadow: 0 0 20px rgba(85, 222, 165, .42);
}

.subdivision-count-hint {
""",
    """  box-shadow: 0 0 20px rgba(85, 222, 165, .42);
  opacity: 1;
}

.count-beat-group span.active::after {
  background: #07100c;
  border: 0;
}

.subdivision-count-hint {
""",
    'active guide cell marker',
)
css_path.write_text(css)

readme_path = Path('README.md')
readme = readme_path.read_text()
readme = replace_once(
    readme,
    '- 현재 서브디비전 시각 표시: `1 &`, `1 trip let`, `1 e & a`\n',
    '- 현재 서브디비전 시각 표시: `1 &`, `1 trip let`, `1 e & a`\n- 4분·8분 클릭에서도 한 박을 `1 e & a` 네 칸으로 나눈 시각 격자와 실제 소리 위치 표시\n',
    'README visual grid',
)
readme_path.write_text(readme)

sw_path = Path('public/sw.js')
sw = sw_path.read_text().replace("const CACHE_NAME = 'barloop-shell-v5';", "const CACHE_NAME = 'barloop-shell-v6';")
sw_path.write_text(sw)

Path('scripts/apply_quarter_visual_grid.py').unlink(missing_ok=True)
Path('.github/workflows/apply-quarter-visual-grid.yml').unlink(missing_ok=True)
