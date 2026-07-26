import type { Subdivision } from '../lib/metronome';
import {
  buildSubdivisionCountGroups,
  getVisualSubdivision,
  getVisualSubdivisionIndex,
  isSubdivisionSoundCell,
} from '../lib/subdivisionCount';

interface SubdivisionCountGuideProps {
  beatsPerBar: number;
  subdivision: Subdivision;
  beatInBar: number;
  subdivisionInBeat: number;
  audible?: boolean;
  compact?: boolean;
  className?: string;
}

export default function SubdivisionCountGuide({
  beatsPerBar,
  subdivision,
  beatInBar,
  subdivisionInBeat,
  audible = true,
  compact = false,
  className = '',
}: SubdivisionCountGuideProps) {
  const visualSubdivision = getVisualSubdivision(subdivision);
  const groups = buildSubdivisionCountGroups(beatsPerBar, visualSubdivision);
  const activeVisualIndex = getVisualSubdivisionIndex(subdivision, subdivisionInBeat);

  return (
    <div
      className={[
        'shared-subdivision-guide',
        beatsPerBar <= 4 ? 'fit-full-bar' : '',
        compact ? 'compact' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-label="한 마디 서브디비전 카운트"
    >
      {groups.map((labels, countBeatIndex) => (
        <div
          key={countBeatIndex}
          className={countBeatIndex === beatInBar ? 'shared-count-beat active-beat' : 'shared-count-beat'}
        >
          {labels.map((label, countSubdivisionIndex) => {
            const soundCell = isSubdivisionSoundCell(subdivision, countSubdivisionIndex);
            const active = countBeatIndex === beatInBar && countSubdivisionIndex === activeVisualIndex;
            return (
              <span
                key={`${countBeatIndex}-${countSubdivisionIndex}`}
                className={[
                  soundCell ? 'sound-on' : 'guide-only',
                  active ? 'active' : '',
                  active && !audible ? 'muted' : '',
                ].filter(Boolean).join(' ')}
                title={soundCell ? '실제 클릭이 나는 위치' : '소리 없이 박을 나누어 보는 안내 위치'}
              >
                <strong>{label}</strong>
                <i aria-hidden="true" />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
