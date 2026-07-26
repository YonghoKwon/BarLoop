import { describe, expect, it } from 'vitest';
import { getKoreanCountLabel, getKoreanCountRate } from './koreanCountVoice';

describe('Korean beat count voice', () => {
  it('maps beat indexes to Korean count words', () => {
    expect([0, 1, 2, 3, 7, 11].map(getKoreanCountLabel)).toEqual([
      '하나',
      '둘',
      '셋',
      '넷',
      '여덟',
      '열둘',
    ]);
  });

  it('increases speaking rate with BPM within safe bounds', () => {
    expect(getKoreanCountRate(40)).toBe(0.8);
    expect(getKoreanCountRate(95)).toBe(1);
    expect(getKoreanCountRate(300)).toBe(2);
  });
});
