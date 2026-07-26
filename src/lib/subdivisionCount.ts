import type { MetronomeSubdivision } from './standaloneMetronome';

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
