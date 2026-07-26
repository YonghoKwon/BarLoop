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
export const MIN_PATTERN_BEATS = 2;
export const MAX_PATTERN_BEATS = 12;

export interface DrumPattern {
  id: string;
  name: string;
  description: string;
  beatsPerBar: number;
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

export function normalizeBeatsPerBar(value: unknown): number {
  return Math.min(MAX_PATTERN_BEATS, Math.max(MIN_PATTERN_BEATS, Math.round(Number(value) || 4)));
}

export function patternStepCount(beatsPerBar: number): number {
  return normalizeBeatsPerBar(beatsPerBar) * 4;
}

const emptySteps = (beatsPerBar = 4): DrumStepLevel[] =>
  Array.from({ length: patternStepCount(beatsPerBar) }, () => 0 as DrumStepLevel);

function toSteps(values: number[] = [], beatsPerBar = 4): DrumStepLevel[] {
  return Array.from({ length: patternStepCount(beatsPerBar) }, (_, index) => {
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
  beatsPerBar = 4,
): DrumPattern {
  const safeBeats = normalizeBeatsPerBar(beatsPerBar);
  return {
    id,
    name,
    description,
    beatsPerBar: safeBeats,
    swing,
    steps: Object.fromEntries(
      DRUM_INSTRUMENT_IDS.map((instrument) => [instrument, toSteps(source[instrument], safeBeats)]),
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
  pattern('offbeat-eighths', '8분 엇박 그루브', '숫자 박보다 모든 & 위치를 선명하게 느끼도록 하이햇과 킥을 엇박에 배치합니다.', 0.5, {
    hihat: [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2],
    kick: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0],
  }),
  pattern('syncopated-sixteenth', '16분 싱코페이션', 'e·&·a에 킥과 고스트 스네어를 배치해 앞뒤로 당겨지는 엇박을 연습합니다.', 0.5, {
    hihat: [2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1],
    snare: [0, 0, 0, 1, 2, 0, 1, 0, 0, 1, 0, 0, 2, 0, 0, 1],
    kick: [2, 0, 1, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0],
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
  pattern('five-four-rock', '5박 록 · 3+2', '5/4를 3+2로 묶어 첫 박과 4박의 중심, 마지막 &의 엇박 킥을 함께 연습합니다.', 0.5, {
    crash: [2],
    hihat: [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0],
    kick: [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0],
  }, 5),
  pattern('seven-four-drive', '7박 드라이브 · 4+3', '7/4를 4+3으로 묶고 후반 3박의 킥·스네어 엇박으로 긴 마디 감각을 익힙니다.', 0.5, {
    crash: [2],
    ride: [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    kick: [2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 1],
  }, 7),
];

export const DEFAULT_CUSTOM_PATTERN: DrumPattern = clonePattern(
  GROOVE_PATTERNS[0],
  'custom',
  '내 커스텀 패턴',
);
DEFAULT_CUSTOM_PATTERN.description = '2~12박 한 마디에서 4피스 드럼과 심벌의 각 16분 칸을 편집할 수 있습니다.';

export const DEFAULT_ROUTINE: PracticeRoutineStep[] = [
  { id: 'warmup', name: '워밍업', bpm: 80, bars: 8, patternId: 'basic-rock', accentTrainer: false },
  { id: 'control', name: '16분 엇박 컨트롤', bpm: 75, bars: 8, patternId: 'syncopated-sixteenth', accentTrainer: true },
  { id: 'odd-meter', name: '5박 그루브', bpm: 90, bars: 8, patternId: 'five-four-rock', accentTrainer: false },
];

export function clonePattern(source: DrumPattern, id = source.id, name = source.name): DrumPattern {
  return {
    ...source,
    id,
    name,
    beatsPerBar: normalizeBeatsPerBar(source.beatsPerBar),
    steps: Object.fromEntries(
      DRUM_INSTRUMENT_IDS.map((instrument) => [instrument, [...source.steps[instrument]]]),
    ) as Record<DrumInstrument, DrumStepLevel[]>,
  };
}

export function resizePattern(source: DrumPattern, beatsPerBar: number): DrumPattern {
  const normalized = normalizePattern(source);
  const safeBeats = normalizeBeatsPerBar(beatsPerBar);
  const nextLength = patternStepCount(safeBeats);
  return {
    ...normalized,
    id: 'custom',
    name: '내 커스텀 패턴',
    beatsPerBar: safeBeats,
    description: `${safeBeats}/4 · ${nextLength}칸 커스텀 패턴`,
    steps: Object.fromEntries(
      DRUM_INSTRUMENT_IDS.map((instrument) => [
        instrument,
        Array.from({ length: nextLength }, (_, index) => normalized.steps[instrument][index] ?? 0),
      ]),
    ) as Record<DrumInstrument, DrumStepLevel[]>,
  };
}

export function normalizePattern(value: unknown): DrumPattern {
  if (!value || typeof value !== 'object') return clonePattern(DEFAULT_CUSTOM_PATTERN);
  const candidate = value as Partial<DrumPattern> & { steps?: Partial<Record<DrumInstrument, unknown>> };
  const longestStoredLength = Math.max(
    0,
    ...DRUM_INSTRUMENT_IDS.map((instrument) =>
      Array.isArray(candidate.steps?.[instrument]) ? (candidate.steps?.[instrument] as unknown[]).length : 0,
    ),
  );
  const derivedBeats = longestStoredLength > 0 ? Math.ceil(longestStoredLength / 4) : 4;
  const beatsPerBar = normalizeBeatsPerBar(candidate.beatsPerBar ?? derivedBeats);
  const normalizeSteps = (instrument: DrumInstrument): DrumStepLevel[] => {
    const raw = Array.isArray(candidate.steps?.[instrument])
      ? candidate.steps?.[instrument] as unknown[]
      : emptySteps(beatsPerBar);
    return Array.from({ length: patternStepCount(beatsPerBar) }, (_, index) => {
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
    beatsPerBar,
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

export function nextMovingAccentIndex(
  current: number,
  mode: 'forward' | 'random',
  totalSteps = 16,
): number {
  const safeTotal = Math.max(1, Math.round(totalSteps));
  if (mode === 'random') {
    const next = Math.floor(Math.random() * safeTotal);
    return next === current ? (next + 1) % safeTotal : next;
  }
  return (current + 1) % safeTotal;
}

export function routineTotalBars(steps: PracticeRoutineStep[]): number {
  return steps.reduce((sum, step) => sum + Math.max(1, Math.round(step.bars)), 0);
}
