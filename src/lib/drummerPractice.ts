export type DrumInstrument =
  | 'crash'
  | 'ride'
  | 'hihat'
  | 'rackTom'
  | 'floorTom'
  | 'snare'
  | 'kick';
export type DrumStepLevel = 0 | 1 | 2;

export interface DrumInstrumentDefinition {
  id: DrumInstrument;
  label: string;
  short: string;
  family: 'cymbal' | 'drum';
}

export const DRUM_INSTRUMENTS: DrumInstrumentDefinition[] = [
  { id: 'crash', label: '크래시', short: 'CR', family: 'cymbal' },
  { id: 'ride', label: '라이드', short: 'RD', family: 'cymbal' },
  { id: 'hihat', label: '하이햇', short: 'HH', family: 'cymbal' },
  { id: 'rackTom', label: '랙 탐', short: 'RT', family: 'drum' },
  { id: 'floorTom', label: '플로어 탐', short: 'FT', family: 'drum' },
  { id: 'snare', label: '스네어', short: 'SN', family: 'drum' },
  { id: 'kick', label: '킥', short: 'BD', family: 'drum' },
];

export const DRUM_INSTRUMENT_IDS = DRUM_INSTRUMENTS.map((instrument) => instrument.id);

export interface DrumPattern {
  id: string;
  name: string;
  description: string;
  swing: number;
  steps: Record<DrumInstrument, DrumStepLevel[]>;
}

export interface PracticeRoutineStep {
  id: string;
  name: string;
  bpm: number;
  bars: number;
  patternId: string;
  accentTrainer: boolean;
}

const emptySteps = (): DrumStepLevel[] => Array.from({ length: 16 }, () => 0 as DrumStepLevel);

function toSteps(values: number[] = []): DrumStepLevel[] {
  return Array.from({ length: 16 }, (_, index) => {
    const value = values[index] ?? 0;
    return value === 2 ? 2 : value === 1 ? 1 : 0;
  });
}

function pattern(
  id: string,
  name: string,
  description: string,
  swing: number,
  source: Partial<Record<DrumInstrument, number[]>>,
): DrumPattern {
  return {
    id,
    name,
    description,
    swing,
    steps: Object.fromEntries(
      DRUM_INSTRUMENT_IDS.map((instrument) => [instrument, toSteps(source[instrument])]),
    ) as Record<DrumInstrument, DrumStepLevel[]>,
  };
}

export const GROOVE_PATTERNS: DrumPattern[] = [
  pattern('basic-rock', '8비트 기본 록', '하이햇 8분음표, 2·4박 스네어와 기본 킥으로 구성한 록 그루브입니다.', 0.5, {
    crash: [2],
    hihat: [0, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2],
    kick: [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 1],
  }),
  pattern('four-floor', '포 온 더 플로어', '매 박의 킥과 2·4박 스네어로 다운비트와 일정한 펄스를 단단히 연습합니다.', 0.5, {
    crash: [2],
    hihat: [0, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2],
    kick: [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2],
  }),
  pattern('sixteenth-funk', '16비트 펑크', '16분 하이햇과 싱코페이션 킥·고스트 스네어로 손발 간격을 연습합니다.', 0.5, {
    hihat: [2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1],
    snare: [0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1],
    kick: [2, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 0, 0, 1],
  }),
  pattern('ride-rock', '라이드 록', '하이햇 대신 라이드로 연주하고 첫 박 크래시를 더한 오픈 그루브입니다.', 0.5, {
    crash: [2],
    ride: [0, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2],
    kick: [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1],
  }),
  pattern('half-time', '하프타임', '3박 스네어와 넓은 킥 간격으로 느린 백비트와 공간감을 연습합니다.', 0.5, {
    crash: [2],
    hihat: [0, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 2],
    kick: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1],
  }),
  pattern('shuffle', '셔플 그루브', '66% 스윙과 백비트를 사용해 긴-짧은 셔플 흐름을 연습합니다.', 0.66, {
    hihat: [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2],
    kick: [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 1],
  }),
  pattern('four-piece-fill', '4피스 탐 필인', '마지막 두 박을 랙 탐·플로어 탐·스네어·킥으로 이동하는 기본 필인입니다.', 0.5, {
    crash: [2],
    hihat: [0, 0, 1, 0, 1, 0, 1, 0],
    rackTom: [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1],
    floorTom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    kick: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  }),
];

export const DEFAULT_CUSTOM_PATTERN: DrumPattern = clonePattern(
  GROOVE_PATTERNS[0],
  'custom',
  '내 커스텀 패턴',
);
DEFAULT_CUSTOM_PATTERN.description = '4피스 드럼과 심벌의 각 칸을 무음·일반·강세로 편집할 수 있습니다.';

export const DEFAULT_ROUTINE: PracticeRoutineStep[] = [
  { id: 'warmup', name: '워밍업', bpm: 80, bars: 8, patternId: 'basic-rock', accentTrainer: false },
  { id: 'control', name: '16분 컨트롤', bpm: 75, bars: 8, patternId: 'sixteenth-funk', accentTrainer: true },
  { id: 'fill', name: '4피스 필인', bpm: 90, bars: 8, patternId: 'four-piece-fill', accentTrainer: false },
];

export function clonePattern(source: DrumPattern, id = source.id, name = source.name): DrumPattern {
  return {
    ...source,
    id,
    name,
    steps: Object.fromEntries(
      DRUM_INSTRUMENT_IDS.map((instrument) => [instrument, [...source.steps[instrument]]]),
    ) as Record<DrumInstrument, DrumStepLevel[]>,
  };
}

export function normalizePattern(value: unknown): DrumPattern {
  if (!value || typeof value !== 'object') return clonePattern(DEFAULT_CUSTOM_PATTERN);
  const candidate = value as Partial<DrumPattern> & { steps?: Partial<Record<DrumInstrument, unknown>> };
  const normalizeSteps = (instrument: DrumInstrument): DrumStepLevel[] => {
    const raw = Array.isArray(candidate.steps?.[instrument])
      ? candidate.steps?.[instrument] as unknown[]
      : emptySteps();
    return Array.from({ length: 16 }, (_, index) => {
      const item = Number(raw[index] ?? 0);
      return item === 2 ? 2 : item === 1 ? 1 : 0;
    });
  };
  return {
    id: typeof candidate.id === 'string' ? candidate.id : 'custom',
    name: typeof candidate.name === 'string' ? candidate.name : '내 커스텀 패턴',
    description: typeof candidate.description === 'string'
      ? candidate.description
      : DEFAULT_CUSTOM_PATTERN.description,
    swing: Number(candidate.swing) >= 0.5 && Number(candidate.swing) <= 0.75
      ? Number(candidate.swing)
      : 0.5,
    steps: Object.fromEntries(
      DRUM_INSTRUMENT_IDS.map((instrument) => [instrument, normalizeSteps(instrument)]),
    ) as Record<DrumInstrument, DrumStepLevel[]>,
  };
}

export function cycleStepLevel(level: DrumStepLevel): DrumStepLevel {
  return level === 0 ? 1 : level === 1 ? 2 : 0;
}

export function grooveById(id: string, customPattern?: DrumPattern): DrumPattern {
  if (id === 'custom' && customPattern) return normalizePattern(customPattern);
  return clonePattern(GROOVE_PATTERNS.find((item) => item.id === id) ?? GROOVE_PATTERNS[0]);
}

export function nextMovingAccentIndex(current: number, mode: 'forward' | 'random'): number {
  if (mode === 'random') {
    const next = Math.floor(Math.random() * 16);
    return next === current ? (next + 1) % 16 : next;
  }
  return (current + 1) % 16;
}

export function routineTotalBars(steps: PracticeRoutineStep[]): number {
  return steps.reduce((sum, step) => sum + Math.max(1, Math.round(step.bars)), 0);
}
