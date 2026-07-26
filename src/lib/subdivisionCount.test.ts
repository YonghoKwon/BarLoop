import { describe, expect, it } from 'vitest';
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
