import { describe, expect, it } from 'vitest';
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
