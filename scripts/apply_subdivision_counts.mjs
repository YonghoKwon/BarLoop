import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(search, replacement);
}

const helper = `import type { MetronomeSubdivision } from './standaloneMetronome';

const SUBDIVISION_TOKENS: Record<MetronomeSubdivision, readonly string[]> = {
  1: [''],
  2: ['', '&'],
  3: ['', 'trip', 'let'],
  4: ['', 'e', '&', 'a'],
};

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
`;

const helperTest = `import { describe, expect, it } from 'vitest';
import {
  buildSubdivisionCountGroups,
  getCurrentSubdivisionCount,
  getSubdivisionCountGroup,
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
});
`;

fs.writeFileSync('src/lib/subdivisionCount.ts', helper);
fs.writeFileSync('src/lib/subdivisionCount.test.ts', helperTest);

let page = fs.readFileSync('src/pages/MetronomeLabPage.tsx', 'utf8');
page = replaceOnce(
  page,
  "import { clampBpm } from '../lib/bpm';\n",
  "import { clampBpm } from '../lib/bpm';\nimport { buildSubdivisionCountGroups, getCurrentSubdivisionCount } from '../lib/subdivisionCount';\n",
  'subdivision count import',
);
page = replaceOnce(
  page,
  "  const rudiment = RUDIMENTS[Math.min(RUDIMENTS.length - 1, Math.max(0, rudimentIndex))];\n  const progress = timerMinutes > 0 ? Math.min(100, (elapsedSeconds / (timerMinutes * 60)) * 100) : 0;\n",
  "  const rudiment = RUDIMENTS[Math.min(RUDIMENTS.length - 1, Math.max(0, rudimentIndex))];\n  const progress = timerMinutes > 0 ? Math.min(100, (elapsedSeconds / (timerMinutes * 60)) * 100) : 0;\n  const subdivisionCountGroups = useMemo(\n    () => buildSubdivisionCountGroups(beatsPerBar, subdivision),\n    [beatsPerBar, subdivision],\n  );\n  const currentSubdivisionCount = getCurrentSubdivisionCount(\n    beatInBar,\n    subdivisionInBeat,\n    subdivision,\n  );\n",
  'subdivision count values',
);
page = replaceOnce(
  page,
  '            <div className="beat-number">{beatInBar + 1}</div>\n',
  '            <div className="beat-number current-count-position">{currentSubdivisionCount}</div>\n',
  'current count display',
);
page = replaceOnce(
  page,
  `          <div className="subdivision-meter">\n            {Array.from({ length: subdivision }, (_, index) => (\n              <i key={index} className={index === subdivisionInBeat ? 'active' : ''} />\n            ))}\n          </div>\n\n          <div className="lab-primary-actions">`,
  `          <div className="subdivision-meter">\n            {Array.from({ length: subdivision }, (_, index) => (\n              <i key={index} className={index === subdivisionInBeat ? 'active' : ''} />\n            ))}\n          </div>\n\n          <div className="subdivision-count-guide" aria-label="한 마디 서브디비전 카운트">\n            {subdivisionCountGroups.map((labels, countBeatIndex) => (\n              <div\n                key={countBeatIndex}\n                className={countBeatIndex === beatInBar ? 'count-beat-group active-beat' : 'count-beat-group'}\n              >\n                {labels.map((label, countSubdivisionIndex) => (\n                  <span\n                    key={\`${countBeatIndex}-\${countSubdivisionIndex}\`}\n                    className={\n                      countBeatIndex === beatInBar && countSubdivisionIndex === subdivisionInBeat\n                        ? 'active'\n                        : ''\n                    }\n                  >\n                    {label}\n                  </span>\n                ))}\n              </div>\n            ))}\n          </div>\n          <p className="subdivision-count-hint">\n            {subdivision === 4\n              ? '16분음표: 1 e & a'\n              : subdivision === 3\n                ? '셋잇단: 1 trip let'\n                : subdivision === 2\n                  ? '8분음표: 1 &'\n                  : '4분음표: 1 2 3 4'}\n          </p>\n\n          <div className="lab-primary-actions">`,
  'subdivision count guide',
);
fs.writeFileSync('src/pages/MetronomeLabPage.tsx', page);

let css = fs.readFileSync('src/metronome-lab.css', 'utf8');
css = replaceOnce(
  css,
  `.subdivision-meter i.active {\n  background: #52dca2;\n}\n\n.lab-primary-actions {`,
  `.subdivision-meter i.active {\n  background: #52dca2;\n}\n\n.current-count-position {\n  max-width: 220px;\n  font-size: clamp(3.2rem, 10vw, 7rem);\n  white-space: nowrap;\n}\n\n.subdivision-count-guide {\n  width: min(100%, 560px);\n  display: flex;\n  gap: 8px;\n  margin-top: 16px;\n  padding: 8px;\n  overflow-x: auto;\n  overscroll-behavior-inline: contain;\n  scrollbar-width: thin;\n  border-radius: 14px;\n  background: rgba(10, 13, 20, .72);\n}\n\n.count-beat-group {\n  flex: 0 0 auto;\n  display: flex;\n  gap: 4px;\n  padding: 5px;\n  border: 1px solid #2e3545;\n  border-radius: 11px;\n  background: #11151e;\n  transition: border-color .08s ease, background .08s ease;\n}\n\n.count-beat-group.active-beat {\n  border-color: rgba(119, 103, 255, .72);\n  background: rgba(119, 103, 255, .1);\n}\n\n.count-beat-group span {\n  min-width: 34px;\n  min-height: 38px;\n  display: grid;\n  place-items: center;\n  padding-inline: 6px;\n  border-radius: 8px;\n  color: #929db1;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: .9rem;\n  font-weight: 800;\n  transition: transform .08s ease, background .08s ease, color .08s ease;\n}\n\n.count-beat-group span:first-child {\n  color: #d9def0;\n}\n\n.count-beat-group span.active {\n  transform: scale(1.1);\n  background: #55dea5;\n  color: #07100c;\n  box-shadow: 0 0 20px rgba(85, 222, 165, .42);\n}\n\n.subdivision-count-hint {\n  margin: 8px 0 0;\n  color: #8e99ae;\n  font-size: .78rem;\n}\n\n.lab-primary-actions {`,
  'subdivision count styles',
);
css = replaceOnce(
  css,
  `  .lab-primary-actions {\n    grid-template-columns: 1fr;\n  }\n`,
  `  .lab-primary-actions {\n    grid-template-columns: 1fr;\n  }\n\n  .subdivision-count-guide {\n    width: 100%;\n    justify-content: flex-start;\n  }\n\n  .count-beat-group span {\n    min-width: 30px;\n    min-height: 36px;\n    padding-inline: 4px;\n  }\n`,
  'mobile subdivision count styles',
);
fs.writeFileSync('src/metronome-lab.css', css);

let readme = fs.readFileSync('README.md', 'utf8');
readme = replaceOnce(
  readme,
  '- 4분·8분·셋잇단·16분음표\n',
  '- 4분·8분·셋잇단·16분음표\n- 현재 서브디비전 시각 표시: `1 &`, `1 trip let`, `1 e & a`\n',
  'README subdivision display',
);
fs.writeFileSync('README.md', readme);

let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = replaceOnce(sw, "const CACHE_NAME = 'barloop-shell-v3';", "const CACHE_NAME = 'barloop-shell-v4';", 'service worker cache');
fs.writeFileSync('public/sw.js', sw);

for (const path of [
  '.github/subdivision-counts.trigger',
  '.github/workflows/apply-subdivision-counts.yml',
  'scripts/apply_subdivision_counts.mjs',
]) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
