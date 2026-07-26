import { describe, expect, it } from 'vitest';
import { getMediaBeatPosition } from './mediaBeat';

describe('media beat position', () => {
  it('tracks sixteenth-note positions from media time', () => {
    expect(getMediaBeatPosition(0, 120, 4, 4, 0)).toMatchObject({ beatInBar: 0, subdivisionInBeat: 0 });
    expect(getMediaBeatPosition(0.125, 120, 4, 4, 0)).toMatchObject({ beatInBar: 0, subdivisionInBeat: 1 });
    expect(getMediaBeatPosition(0.25, 120, 4, 4, 0)).toMatchObject({ beatInBar: 0, subdivisionInBeat: 2 });
    expect(getMediaBeatPosition(0.5, 120, 4, 4, 0)).toMatchObject({ beatInBar: 1, subdivisionInBeat: 0 });
  });

  it('applies positive and negative sync offsets consistently', () => {
    expect(getMediaBeatPosition(0.5, 120, 4, 1, 0, 100)).toMatchObject({ beatInBar: 0 });
    expect(getMediaBeatPosition(0.5, 120, 4, 1, 0, -100)).toMatchObject({ beatInBar: 1 });
  });

  it('reports positions before the first downbeat', () => {
    expect(getMediaBeatPosition(1, 120, 4, 4, 2)).toMatchObject({
      beforeDownbeat: true,
      absoluteSubdivisionIndex: -1,
    });
  });
});
